// cloudfunctions/ai-menu/index.js
// AI酒单云函数 — 百炼工作流应用 API 生成
//
// 环境变量：
//   BAILIAN_API_KEY  必填  阿里云百炼 API Key
//   BAILIAN_APP_ID   可选  工作流应用 ID（优先于 config.js 中的 WORKFLOW_APP_ID）
//
// Actions:
//   getConfig  — 返回 goals/flavors 配置（供前端动态加载）
//   generate   — 同步生成酒单（主流程）
//   quota      — 查询配额
//   submit     — 兼容旧前端（内部调用 generate）
//   poll       — 兼容旧前端（result 已在 submit 存好）

const cloud = require('wx-server-sdk')
const https  = require('https')
const CFG    = require('./config')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db  = cloud.database()
const _   = db.command
const col = db.collection('shops')

const QUOTA_FREE = 10
const CACHE_TTL  = 30 * 60 * 1000   // 30 分钟缓存

// ── 主入口 ────────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  switch (event.action) {
    case 'getConfig': return actionGetConfig()
    case 'generate':  return await actionGenerate(OPENID, event)
    case 'quota':     return await actionQuota(OPENID)
    // 向后兼容：旧版前端用 submit/poll
    case 'submit':    return await actionLegacySubmit(OPENID, event)
    case 'poll':      return await actionLegacyPoll(OPENID, event)
    default:          return { success: false, error: 'unknown_action' }
  }
}

// ── getConfig：返回前端可用的目标/风味选项 ───────────────
function actionGetConfig() {
  return {
    success: true,
    goals:   CFG.GOALS,
    flavors: CFG.FLAVORS,
  }
}

// ── generate：百炼同步生成酒单（主流程）─────────────────
async function actionGenerate(openid, event) {
  const { goal = '高利润', flavor = '果味', customPrompt = '' } = event
  let shop = null   // 提升到 try 外，供 catch 清缓存用
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    shop         = shops[0]
    const isPro = (shop.plan || '').toLowerCase() === 'pro'
    const now   = Date.now()

    // 配额重置 & 检查
    const needsReset = _needsMonthlyReset(shop.aiQuotaReset || 0, now)
    let currentUsed  = needsReset ? 0 : (shop.aiQuotaUsed || 0)
    if (needsReset) {
      await col.doc(shop._id).update({ data: { aiQuotaUsed: 0, aiQuotaReset: now } })
    }
    if (!isPro && currentUsed >= QUOTA_FREE) {
      return { success: false, error: 'quota_exceeded', quotaUsed: currentUsed, quotaLimit: QUOTA_FREE }
    }

    // 缓存命中（有 customPrompt 时跳过缓存，因参数唯一）
    const cacheKey = `${goal}_${flavor}_${_dateStr(now)}`
    if (!customPrompt) {
      const cached = shop.aiMenuCache && shop.aiMenuCache[cacheKey]
      if (cached && (now - cached.ts) < CACHE_TTL) {
        return {
          success: true, fromCache: true,
          cocktails:      cached.cocktails,
          quotaUsed:      currentUsed,
          quotaRemaining: isPro ? null : QUOTA_FREE - currentUsed,
        }
      }
    }

    // 读取库存
    const { data: ingredients } = await db.collection('ingredients')
      .where({ _openid: openid }).limit(100).get()
    const allIngredients = ingredients.map(i => i.name).join(', ')
    const lowStockItems  = ingredients
      .filter(i => i.status !== 'ok')
      .map(i => ({ name: i.name, stock: i.stock, unit: i.unit, threshold: i.threshold, status: i.status }))

    // 调用百炼工作流 API（biz_params 由工作流处理提示词）
    const bizParams = {
      goal,
      flavor,
      shop_name:       shop.name || '酒吧',
      all_ingredients: allIngredients,
      low_stock_items: JSON.stringify(lowStockItems),
      output_format:   'json',
    }
    if (customPrompt) bizParams.custom_requirement = customPrompt

    const rawText   = await _callBailianWorkflow(bizParams)
    const cocktails = parseAIOutput(rawText, ingredients)

    // 解析失败（空结果）时不写缓存、不扣配额，直接返回错误
    if (!cocktails.length) {
      return { success: false, error: 'parse_failed' }
    }

    // 写缓存 & 扣配额
    await col.doc(shop._id).update({
      data: {
        aiQuotaUsed: _.inc(1),
        [`aiMenuCache.${cacheKey}`]: { ts: now, cocktails },
      }
    })

    const quotaUsed = currentUsed + 1
    return {
      success: true, fromCache: false,
      cocktails,
      quotaUsed,
      quotaRemaining: isPro ? null : Math.max(0, QUOTA_FREE - quotaUsed),
    }

  } catch (e) {
    console.error('[actionGenerate]', e)
    // 生成失败时清除该 shop 的酒单缓存，避免下次命中脏数据
    if (shop && shop._id) {
      try { await col.doc(shop._id).update({ data: { aiMenuCache: db.command.remove() } }) } catch (_) {}
    }
    return { success: false, error: e.message || 'internal_error' }
  }
}

// ── quota ─────────────────────────────────────────────────
async function actionQuota(openid) {
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop  = shops[0]
    const isPro = (shop.plan || '').toLowerCase() === 'pro'
    const used  = shop.aiQuotaUsed || 0
    return {
      success: true, plan: shop.plan || 'free', quotaUsed: used,
      quotaLimit:     isPro ? null : QUOTA_FREE,
      quotaRemaining: isPro ? null : Math.max(0, QUOTA_FREE - used),
    }
  } catch (e) { return { success: false, error: e.message } }
}

// ── 向后兼容：旧版前端 submit ─────────────────────────────
// 直接调 generate，把结果存到 aiTaskResult，返回 taskId
async function actionLegacySubmit(openid, event) {
  const taskId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const result = await actionGenerate(openid, event)
  if (result.success) {
    try {
      const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
      if (shops.length) {
        await col.doc(shops[0]._id).update({
          data: { [`aiTaskResult.${taskId}`]: { cocktails: result.cocktails, savedAt: Date.now() } }
        })
      }
    } catch (_) {}
    if (result.fromCache) return { ...result, taskId }
    return { success: true, fromCache: false, taskId, quotaUsed: result.quotaUsed }
  }
  return result
}

// ── 向后兼容：旧版前端 poll ───────────────────────────────
async function actionLegacyPoll(openid, event) {
  const { taskId } = event
  if (!taskId) return { success: false, error: 'taskId_required' }
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop   = shops[0]
    const result = shop.aiTaskResult && shop.aiTaskResult[taskId]
    if (!result) return { success: true, status: 'pending' }
    await col.doc(shop._id).update({ data: { [`aiTaskResult.${taskId}`]: db.command.remove() } })
    const isPro = (shop.plan || '').toLowerCase() === 'pro'
    return {
      success: true, status: 'done',
      cocktails:      result.cocktails || [],
      quotaUsed:      shop.aiQuotaUsed || 0,
      quotaRemaining: isPro ? null : Math.max(0, QUOTA_FREE - (shop.aiQuotaUsed || 0)),
    }
  } catch (e) { return { success: false, error: e.message } }
}

// ── _callBailianWorkflow：调用百炼工作流应用 responses API ─
async function _callBailianWorkflow(bizParams) {
  const API_KEY = process.env.BAILIAN_API_KEY || ''
  const APP_ID  = process.env.BAILIAN_APP_ID  || CFG.WORKFLOW_APP_ID || ''

  if (!API_KEY) throw new Error('BAILIAN_API_KEY not configured')
  if (!APP_ID)  throw new Error('BAILIAN_APP_ID not configured')

  const url  = `https://dashscope.aliyuncs.com/api/v2/apps/agent/${APP_ID}/compatible-mode/v1/responses`
  const body = JSON.stringify({ stream: false, biz_params: bizParams })

  const raw = await _httpsPost(url, {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
  }, body)

  const res = JSON.parse(raw)

  // 取原始文本：兼容 compatible-mode responses API 的三种结构
  let text = res.result
    || res.output_text
    || (res.output && res.output[0] && res.output[0].content
        && res.output[0].content[0] && res.output[0].content[0].text)
    || ''
  if (!text) throw new Error('empty response from workflow: ' + JSON.stringify(res).slice(0, 200))

  // 百炼工作流会将所有输出变量打包为 JSON 对象字符串返回，例如：
  //   '{"result":"[{...}]"}'
  // 需要再解包一层，取出 result 字段（工作流输出变量名）
  if (text.trimStart().startsWith('{')) {
    try {
      const inner = JSON.parse(text)
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        text = inner.result || inner.output || inner.text || text
      }
    } catch (_) {}
  }

  return text
}

// ── parseAIOutput ─────────────────────────────────────────
function parseAIOutput(text, inventorySnapshot) {
  if (!text) return []
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    let parsed = JSON.parse(cleaned)
    if (parsed && !Array.isArray(parsed)) {
      let candidate = parsed.cocktails || parsed.data || parsed.result || []
      // 工作流 result 字段可能仍是 JSON 字符串，再 parse 一次
      if (typeof candidate === 'string') {
        try { candidate = JSON.parse(candidate) } catch (_) {}
      }
      parsed = candidate
    }
    if (!Array.isArray(parsed)) return []
    const stockMap = {}
    ;(inventorySnapshot || []).forEach(i => { stockMap[i.name] = i })
    return parsed.slice(0, CFG.MAX_COCKTAILS).map((item, idx) => ({
      emoji:          item.emoji          || '🍸',
      name:           item.name           || `推荐酒款 ${idx + 1}`,
      matchScore:     Number(item.matchScore)     || 80,
      matchLevel:     _matchLevel(Number(item.matchScore) || 80),
      costEstimate:   Number(item.costEstimate)   || 0,
      suggestedPrice: Number(item.suggestedPrice) || 0,
      grossMargin:    Number(item.grossMargin)    || 0,
      substitute:     item.substitute             || null,
      ingredients: (item.ingredients || []).map(ing => ({
        name: ing.name, amount: Number(ing.amount) || 0, unit: ing.unit || '',
        isMissing: _isMissing(ing.name, stockMap),
      })),
      steps:    Array.isArray(item.steps) ? item.steps : [],
      notes:    item.notes || '',
      expanded: idx === 0,
    }))
  } catch (e) {
    console.error('[parseAIOutput]', e.message, text.slice(0, 200))
    return []
  }
}

function _matchLevel(s)  { return s >= 80 ? 'ok' : s >= 60 ? 'warn' : 'danger' }
function _isMissing(name, stockMap) {
  const i = stockMap[name]
  return i ? (i.status === 'danger' || i.stock <= 0) : false
}
function _needsMonthlyReset(ts, now) {
  if (!ts) return true
  const r = new Date(ts), n = new Date(now)
  return r.getFullYear() < n.getFullYear() || r.getMonth() < n.getMonth()
}
function _dateStr(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}
function _httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url)
    const lib = u.protocol === 'https:' ? https : require('http')
    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || 443,
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  { ...headers, 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data)
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`))
      })
    })
    req.on('error', reject)
    req.setTimeout(55000, () => { req.destroy(); reject(new Error('request timeout')) })
    req.write(body)
    req.end()
  })
}
