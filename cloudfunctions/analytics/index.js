// cloudfunctions/analytics/index.js
// 云函数：analytics
// 从 stock_logs 聚合真实经营数据（周/月维度）
//
// Actions:
//   summary  - KPI 汇总 + 趋势图数据 + 原料消耗排行
//   snapshot - 写入每日快照（可由定时触发器调用）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db   = cloud.database()
const _    = db.command
const logs = db.collection('stock_logs')
const ings = db.collection('ingredients')

const sales = db.collection('sales_records')

exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  const { action = 'summary', period = 'week' } = event

  switch (action) {
    case 'summary':      return await actionSummary(OPENID, period)
    case 'aiAdvice':     return await actionAIAdvice(OPENID, event)
    case 'dashSummary':  return await actionDashSummary(OPENID)
    case 'saleAdd':      return await actionSaleAdd(OPENID, event)
    case 'saleList':     return await actionSaleList(OPENID, event)
    case 'saleDelete':   return await actionSaleDelete(OPENID, event)
    default:             return { success: false, error: 'unknown_action' }
  }
}

// ── summary：KPI + 趋势 + 排行 ───────────────────────────
async function actionSummary(openid, period) {
  try {
    const now = Date.now()
    const { startTs, prevStartTs, labels, buckets, startDateStr, prevStartDateStr } = _periodConfig(period, now)
    const nowDateStr = _dateStr(now)

    // ① 本期 sales_records（用户录入的真实营业额 & 出杯数）
    const { data: curSales } = await sales
      .where({ _openid: openid, date: _.gte(startDateStr).and(_.lte(nowDateStr)) })
      .orderBy('date', 'asc')
      .limit(100)
      .get()

    // ② 上期 sales_records（用于环比）
    const { data: prevSales } = await sales
      .where({ _openid: openid, date: _.gte(prevStartDateStr).and(_.lt(startDateStr)) })
      .limit(100)
      .get()

    // ③ 本期出库日志（delta < 0 = 原料消耗，用于成本计算）
    const { data: curLogs } = await logs
      .where({ _openid: openid, delta: _.lt(0), createdAt: _.gte(startTs).and(_.lt(now)) })
      .limit(500)
      .get()

    // ④ 上期出库日志（原料成本环比）
    const { data: prevLogs } = await logs
      .where({ _openid: openid, delta: _.lt(0), createdAt: _.gte(prevStartTs).and(_.lt(startTs)) })
      .limit(500)
      .get()

    // ⑤ 当前库存（含成本价）
    const { data: inventory } = await ings
      .where({ _openid: openid })
      .limit(200)
      .get()

    const costMap = {}
    inventory.forEach(i => { costMap[i.name] = Number(i.costPerUnit) || 0 })

    const kpi            = calcKPI(curSales, prevSales, curLogs, prevLogs, costMap)
    const trend          = calcTrend(curSales, curLogs, costMap, labels, buckets, period)
    const topIngredients = calcTopIngredients(curLogs, costMap)
    const stockDist      = calcStockDist(inventory)
    // isEmpty 只看 sales_records：无销售记录则 KPI 为空，原料消耗/库存分布仍正常返回
    const isEmpty        = curSales.length === 0

    return { success: true, period, isEmpty, kpi, trend, topIngredients, stockDist }
  } catch (e) {
    console.error('[analytics] summary error:', e)
    return { success: false, error: e.message || 'internal_error' }
  }
}

// ── calcKPI ───────────────────────────────────────────────
function calcKPI(curSales, prevSales, curLogs, prevLogs, costMap) {
  // ── 真实营业额 & 出杯数（来自 sales_records）────────────
  const revenue    = curSales.reduce((s, r) => s + (r.revenue || 0), 0)
  const cups       = curSales.reduce((s, r) => s + (r.cups    || 0), 0)
  const prevRevSales = prevSales.reduce((s, r) => s + (r.revenue || 0), 0)

  // ── 原料成本（来自 stock_logs）──────────────────────────
  let totalCost = 0
  curLogs.forEach(log => {
    totalCost += Math.abs(log.delta) * (costMap[log.ingredientName] || 0)
  })
  totalCost = Math.round(totalCost)

  let prevCost = 0
  prevLogs.forEach(log => {
    prevCost += Math.abs(log.delta) * (costMap[log.ingredientName] || 0)
  })

  // 无 sales_records 时直接为 0，不再用成本倒推假数据
  const finalRevenue = revenue   // 0 when no sales records
  const finalCups    = cups
  const prevRevenue  = prevRevSales

  // 无营业额时 profit/margin 无意义，不从 0 减成本得负数
  const profit   = finalRevenue > 0 ? finalRevenue - totalCost : 0
  const margin   = finalRevenue > 0 ? Math.round((profit / finalRevenue) * 100) : 0
  const avgOrder = finalCups > 0 ? Math.round(finalRevenue / finalCups) : 0
  const costRate = finalRevenue > 0 ? Math.round((totalCost / finalRevenue) * 100) : 0

  const revenueDiff    = prevRevenue > 0 ? Math.round(((finalRevenue - prevRevenue) / prevRevenue) * 100) : 0
  const revenueTrendUp = revenueDiff >= 0

  return {
    revenue:      _fmt(finalRevenue),
    profit:       _fmt(profit),
    margin,
    cups:         finalCups,
    avgOrder,
    materialCost: _fmt(totalCost),
    costRate,
    revenueTrendUp,
    revenueTrend: revenueDiff !== 0
      ? `${revenueTrendUp ? '↑' : '↓'} 较上期 ${revenueTrendUp ? '+' : ''}${revenueDiff}%`
      : '与上期持平',
    revenueNum: finalRevenue,
    profitNum:  profit,
  }
}

// ── calcTrend：按时间桶聚合趋势数据 ──────────────────────
// revenue 来自 sales_records（真实），profit = revenue - 原料成本（来自 stock_logs）
function calcTrend(curSales, curLogs, costMap, labels, buckets, period) {
  const n       = buckets.length
  const revenue = new Array(n).fill(0)
  const cost    = new Array(n).fill(0)

  // 原料成本按时间桶聚合（stock_logs 用 createdAt 时间戳）
  curLogs.forEach(log => {
    const c   = Math.abs(log.delta) * (costMap[log.ingredientName] || 0)
    const idx = _bucketIndex(log.createdAt, buckets, period)
    if (idx >= 0) cost[idx] += c
  })

  // 真实营业额按日期字符串分桶（避免时区问题）；无 sales_records 则 revenue 全为 0
  const bucketDates = buckets.map(ts => _dateStr(ts))
  curSales.forEach(rec => {
    const idx = _bucketIdxByDate(rec.date, bucketDates, period)
    if (idx >= 0) revenue[idx] += rec.revenue || 0
  })

  return {
    labels,
    revenue: revenue.map(v => Math.round(v)),
    // 某桶内无营业额时 profit 保持 0，不做 revenue-cost（否则 cost>0 时会出负值）
    profit:  revenue.map((v, i) => v > 0 ? Math.round(v - cost[i]) : 0),
  }
}

// ── calcTopIngredients：原料消耗 Top5 ────────────────────
function calcTopIngredients(curLogs, costMap) {
  const map = {}
  curLogs.forEach(log => {
    const name = log.ingredientName
    if (!map[name]) map[name] = { name, used: 0, cost: 0 }
    map[name].used += Math.abs(log.delta)
    map[name].cost += Math.abs(log.delta) * (costMap[name] || 0)
  })

  const list = Object.values(map)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)

  if (!list.length) return []
  const maxCost = list[0].cost

  const COLORS = ['#c9a96e', '#4caf84', '#9a98a0', '#5c8fd6', '#d4746a']
  return list.map((item, i) => ({
    name:  item.name,
    used:  Math.round(item.used * 10) / 10,
    cost:  Math.round(item.cost),
    color: COLORS[i] || '#5c5b65',
    pct:   maxCost > 0 ? Math.round((item.cost / maxCost) * 100) : 0,
  }))
}

// ── calcStockDist：库存状态分布（用于柱图）────────────────
function calcStockDist(inventory) {
  const dist = { ok: 0, warn: 0, danger: 0 }
  inventory.forEach(i => {
    if (i.status === 'danger')     dist.danger++
    else if (i.status === 'warn')  dist.warn++
    else                           dist.ok++
  })
  const total = inventory.length || 1
  return {
    labels: ['正常', '偏低', '告急'],
    values: [
      Math.round((dist.ok     / total) * 100),
      Math.round((dist.warn   / total) * 100),
      Math.round((dist.danger / total) * 100),
    ],
    colors: ['#4caf84', '#c9a96e', '#e05c5c'],
    raw:    dist,
  }
}

// ── actionDashSummary：Dashboard 一次拉取所有数据 ─────────
async function actionDashSummary(openid) {
  try {
    const now       = Date.now()
    const today     = _dateStr(now)
    const yesterday = _dateStr(now - 86400000)
    const weekStartTs = _weekStart(now)

    // 最近 8 天销售记录
    const { data: recentSales } = await sales
      .where({ _openid: openid })
      .orderBy('date', 'desc')
      .limit(8)
      .get()

    const todayRec     = recentSales.find(r => r.date === today)     || null
    const yesterdayRec = recentSales.find(r => r.date === yesterday) || null
    const weekSales    = recentSales.filter(r => new Date(r.date).getTime() >= weekStartTs)
    const weekRevenue  = weekSales.reduce((s, r) => s + (r.revenue || 0), 0)
    const weekCups     = weekSales.reduce((s, r) => s + (r.cups    || 0), 0)

    // 今日 vs 昨日趋势
    let todayTrend = null
    if (todayRec && yesterdayRec && yesterdayRec.revenue > 0) {
      const diff = Math.round(((todayRec.revenue - yesterdayRec.revenue) / yesterdayRec.revenue) * 100)
      todayTrend = { diff, up: diff >= 0, text: `${diff >= 0 ? '↑' : '↓'} 较昨日 ${diff >= 0 ? '+' : ''}${diff}%` }
    } else if (todayRec && !yesterdayRec) {
      todayTrend = { diff: 0, up: true, text: '昨日暂无记录' }
    }

    // 本周毛利润估算（来自 stock_logs）
    let weekProfit = null, weekMargin = null
    try {
      const ws = await actionSummary(openid, 'week')
      if (ws.success && !ws.isEmpty) { weekProfit = ws.kpi.profit; weekMargin = ws.kpi.margin }
    } catch (_) {}

    return {
      success: true,
      todayRec, yesterdayRec, todayTrend,
      weekRevenue, weekCups, weekRecordCount: weekSales.length,
      weekProfit, weekMargin,
      recentSales: recentSales.slice(0, 7),
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── actionSaleAdd：新建 / 更新某日销售记录 ────────────────
async function actionSaleAdd(openid, event) {
  const { date, revenue, cups, note } = event
  if (!date || revenue == null) return { success: false, error: 'missing_fields' }
  const now = Date.now()
  const { data } = await sales.where({ _openid: openid, date }).limit(1).get()
  if (data[0]) {
    await sales.doc(data[0]._id).update({ data: { revenue: Number(revenue), cups: Number(cups) || 0, note: note || '', updatedAt: now } })
    return { success: true, updated: true, id: data[0]._id }
  }
  const res = await sales.add({ data: { date, revenue: Number(revenue), cups: Number(cups) || 0, note: note || '', createdAt: now, updatedAt: now } })
  return { success: true, updated: false, id: res._id }
}

// ── actionSaleList：列出最近 N 天记录 ────────────────────
async function actionSaleList(openid, event) {
  const { limit = 30 } = event
  const { data } = await sales.where({ _openid: openid }).orderBy('date', 'desc').limit(limit).get()
  return { success: true, data }
}

// ── actionSaleDelete：删除某日记录 ───────────────────────
async function actionSaleDelete(openid, event) {
  const { date } = event
  const { data } = await sales.where({ _openid: openid, date }).limit(1).get()
  if (!data[0]) return { success: false, error: 'not_found' }
  await sales.doc(data[0]._id).remove()
  return { success: true }
}

// ── 时间配置 ──────────────────────────────────────────────
function _periodConfig(period, now) {
  const d = new Date(now)

  if (period === 'week') {
    const dow         = d.getDay() === 0 ? 6 : d.getDay() - 1  // 0=Mon
    const start       = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
    const startTs     = start.getTime()
    const prevStartTs = startTs - 7 * 86400000
    const labels      = ['周一','周二','周三','周四','周五','周六','周日']
    const buckets     = Array.from({ length: 7 }, (_, i) => startTs + i * 86400000)
    return { startTs, prevStartTs, labels, buckets, startDateStr: _dateStr(startTs), prevStartDateStr: _dateStr(prevStartTs) }
  }

  // month
  const start       = new Date(d.getFullYear(), d.getMonth(), 1)
  const startTs     = start.getTime()
  const prevStart   = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const prevStartTs = prevStart.getTime()
  const weekMs      = 7 * 86400000
  const labels      = ['第1周','第2周','第3周','第4周']
  const buckets     = Array.from({ length: 4 }, (_, i) => startTs + i * weekMs)
  return { startTs, prevStartTs, labels, buckets, startDateStr: _dateStr(startTs), prevStartDateStr: _dateStr(prevStartTs) }
}

// 按日期字符串（YYYY-MM-DD）找时间桶索引，规避时区问题
function _bucketIdxByDate(dateStr, bucketDates, period) {
  if (period === 'week') {
    // 周视图：每桶一天，精确匹配
    return bucketDates.indexOf(dateStr)
  }
  // 月视图：每桶一周，找最后一个 bucketDate <= dateStr
  for (let i = bucketDates.length - 1; i >= 0; i--) {
    if (dateStr >= bucketDates[i]) return i
  }
  return -1
}

function _bucketIndex(ts, buckets, period) {
  const unit = period === 'week' ? 86400000 : 7 * 86400000
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (ts >= buckets[i] && ts < buckets[i] + unit) return i
  }
  return -1
}

function _fmt(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function _dateStr(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function _weekStart(ts) {
  const d   = new Date(ts)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime()
}
// ── actionAIAdvice：调用 Dify 生成 AI 经营建议 ────────────
// 专供 Pro 用户使用，每日最多调用 3 次（避免滥用）
// 环境变量：DIFY_ANALYTICS_API_KEY（可与 ai-menu 用同一个 Key 的不同应用）
async function actionAIAdvice(openid, event) {
  const { period = 'week', forceRefresh = false } = event
  try {
    // 鉴权：仅 Pro 用户
    const { data: [shop] } = await db.collection('shops').where({ _openid: openid }).limit(1).get()
    if (!shop) return { success: false, error: 'shop_not_found' }
    if ((shop.plan || '').toLowerCase() !== 'pro') return { success: false, error: 'pro_required' }

    // 每日次数限制（3次）
    const now       = Date.now()
    const todayStr  = _dateStr(now)
    const advCache  = shop.aiAdviceCache || {}
    const todayUsed = advCache[`count_${todayStr}`] || 0

    // 缓存命中（同 period、同日、30 分钟内）
    const cacheKey = `${period}_${todayStr}`
    const cached   = advCache[cacheKey]
    if (cached && !forceRefresh && (now - (cached.ts || 0)) < 30 * 60 * 1000) {
      return { success: true, fromCache: true, advice: cached.advice }
    }

    if (todayUsed >= 3 && !forceRefresh) {
      return { success: false, error: 'daily_limit', limit: 3, used: todayUsed }
    }

    // 拉取经营数据做摘要
    const summaryResult = await actionSummary(openid, period)
    if (!summaryResult.success) return { success: false, error: 'summary_failed' }

    const { kpi, topIngredients, stockDist, isEmpty } = summaryResult
    const contextStr = JSON.stringify({
      period,
      kpi: {
        revenue: kpi.revenueNum, profit: kpi.profitNum,
        margin: kpi.margin, cups: kpi.cups,
        costRate: kpi.costRate, trend: kpi.revenueTrend,
      },
      topIngredients: topIngredients.slice(0, 3).map(i => ({ name: i.name, cost: i.cost })),
      stockStatus: stockDist ? stockDist.raw : {},
    })

    // 优先调用 Dify chatflow（DIFY_ANALYTICS_API_KEY 优先，降级用 DIFY_API_KEY）
    let advice = null
    const DIFY_KEY = process.env.DIFY_ANALYTICS_API_KEY || process.env.DIFY_API_KEY || ''
    if (DIFY_KEY) {
      advice = await _callDifyAdvice(DIFY_KEY, contextStr, shop.name || '酒吧')
    }
    // 降级：规则生成建议（不依赖外部 API）
    if (!advice) {
      advice = _generateRuleAdvice(kpi, topIngredients, stockDist, period, isEmpty)
    }
    if (!advice) return { success: false, error: 'ai_failed' }

    // 写缓存 + 计数
    const patch = {
      [`aiAdviceCache.${cacheKey}`]:           { ts: now, advice },
      [`aiAdviceCache.count_${todayStr}`]:     todayUsed + 1,
    }
    await db.collection('shops').doc(shop._id).update({ data: patch })

    return { success: true, fromCache: false, advice }

  } catch (e) {
    console.error('[actionAIAdvice]', e)
    return { success: false, error: e.message }
  }
}

// ── _callDifyAdvice：调用 Dify Chatflow 生成经营建议 ──────
async function _callDifyAdvice(apiKey, contextStr, shopName) {
  const BASE_URL = (process.env.DIFY_API_URL || 'https://api.dify.ai/v1').replace(/\/$/, '')
  const query = `你是一名小酒馆经营顾问。请根据以下经营数据，给出3条简短实用的经营建议。` +
    `每条建议格式：{"icon":"emoji","title":"标题（10字内）","text":"正文（60字内）"}。` +
    `请只返回JSON数组，不要其他内容。\n\n店名：${shopName}\n经营数据：${contextStr}`
  const bodyStr = JSON.stringify({
    inputs:          {},
    query,
    response_mode:   'blocking',
    conversation_id: '',
    user:            'bacchus-analytics',
  })
  try {
    const raw = await _httpsPost(`${BASE_URL}/chat-messages`, {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    }, bodyStr)
    const res  = JSON.parse(raw)
    const text = res.answer || ''
    return _parseAdvice(text)
  } catch (e) {
    console.error('[_callDifyAdvice]', e)
    return null
  }
}

// ── _generateRuleAdvice：基于数据的规则建议（无需外部 API）──
function _generateRuleAdvice(kpi, topIngredients, stockDist, period, isEmpty) {
  const periodLabel = period === 'week' ? '周' : '月'
  const advice = []

  // 无销售数据 → 引导录入
  if (isEmpty || !kpi || kpi.revenueNum === 0) {
    return [
      { icon: '📝', title: '开始记录营业数据', text: `还没有本${periodLabel}的销售记录。建议每日录入营业额和出杯数，让系统帮你追踪经营趋势。` },
      { icon: '📦', title: '完善库存信息', text: '为每种原料设置单位成本价，系统可自动估算毛利率，让你随时掌握经营健康度。' },
      { icon: '🎯', title: '利用 AI 酒单功能', text: '根据现有库存让 AI 推荐当日特调，减少原料积压，提升周转效率。' },
    ]
  }

  // 趋势分析
  if (kpi.revenueTrendUp === false && kpi.revenueTrend && kpi.revenueTrend !== '与上期持平') {
    advice.push({
      icon: '📉', title: `本${periodLabel}营业额下滑`,
      text: `营业额${kpi.revenueTrend}，建议推出限时特惠或联合周边商家引流，刺激消费回升。`,
    })
  } else if (kpi.revenueTrendUp === true && kpi.revenueTrend && kpi.revenueTrend !== '与上期持平') {
    advice.push({
      icon: '📈', title: '营业额持续增长',
      text: `营业额${kpi.revenueTrend}，势头良好！趁势强化口碑营销和复购激励，巩固增长。`,
    })
  } else {
    advice.push({
      icon: '📊', title: '营业额趋于平稳',
      text: `本${periodLabel}与上期持平，可尝试推出新品或套餐，给客人新鲜感以带动增长。`,
    })
  }

  // 毛利率
  if (kpi.margin > 0 && kpi.margin < 40) {
    advice.push({
      icon: '💰', title: `毛利率偏低（${kpi.margin}%）`,
      text: `成本占比较高，建议检查${topIngredients[0] ? `「${topIngredients[0].name}」等` : ''}高成本原料是否有议价空间或替代方案。`,
    })
  } else if (kpi.margin >= 55) {
    advice.push({
      icon: '✅', title: `毛利率健康（${kpi.margin}%）`,
      text: `成本控制良好。可考虑将部分利润投入品牌宣传或设备升级，提升客户体验。`,
    })
  } else if (kpi.margin > 0) {
    advice.push({
      icon: '💡', title: `毛利率（${kpi.margin}%）尚有提升空间`,
      text: `可通过提高客单价或优化原料采购来改善利润率，目标毛利率建议在 55% 以上。`,
    })
  }

  // 库存预警
  const raw = stockDist && stockDist.raw
  if (raw && raw.danger > 0) {
    advice.push({
      icon: '🚨', title: `${raw.danger} 种原料库存告急`,
      text: '部分原料已临近断货，请尽快安排补货，避免因缺货影响出品和客户体验。',
    })
  } else if (raw && raw.warn > 0) {
    advice.push({
      icon: '⚠️', title: `${raw.warn} 种原料库存偏低`,
      text: '建议近期安排补货，保持安全库存水位，避免临时采购成本偏高。',
    })
  }

  // 客单价
  if (kpi.avgOrder > 0 && kpi.avgOrder < 35) {
    advice.push({
      icon: '🍹', title: '提升客单价',
      text: `当前均单约 ¥${kpi.avgOrder}，可推出特调套餐或精品配对，引导客人选择更高客单价品项。`,
    })
  }

  // 成本最高原料
  if (topIngredients.length > 0 && advice.length < 3) {
    const top = topIngredients[0]
    advice.push({
      icon: '🧪', title: '关注高成本原料',
      text: `「${top.name}」是本${periodLabel}最大成本项（约 ¥${top.cost}），重点追踪其用量和采购价格，有助于有效控本。`,
    })
  }

  return advice.slice(0, 3)
}

function _parseAdvice(text) {
  if (!text) return null
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    const arr   = JSON.parse(clean)
    if (Array.isArray(arr)) return arr
    if (arr.advice) return arr.advice
    return null
  } catch (_) {
    // 纯文本格式：按行分割成 advice 列表
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    return lines.slice(0, 3).map((l, i) => ({
      icon:  ['📈','💡','⚠️'][i] || '📌',
      title: `建议 ${i + 1}`,
      text:  l.replace(/^[-•\d.]+\s*/, ''),
    }))
  }
}

// ── HTTP 工具（analytics 云函数自用）─────────────────────
function _httpsPost(url, headers, body) {
  const https  = require('https')
  return new Promise((resolve, reject) => {
    const urlObj  = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port:     urlObj.port || 443,
      path:     urlObj.pathname + urlObj.search,
      method:   'POST',
      headers:  { ...headers, 'Content-Length': Buffer.byteLength(body) },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data)
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
      })
    })
    req.on('error', reject)
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}
