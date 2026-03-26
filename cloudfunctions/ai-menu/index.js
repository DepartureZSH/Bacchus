// cloudfunctions/ai-menu/index.js
// 云函数：ai-menu  —  submit+poll 异步模式（解决60秒超时）
//
// 环境变量：
//   DIFY_API_KEY  - Dify Chatflow 应用的 API Key
//   DIFY_API_URL  - Dify 接口地址（默认 https://api.dify.ai/v1）
//
// 调用流程：
//   前端 → submit（~3秒，拿 task_id） → 每2秒 poll → 完成后返回 cocktails

const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db  = cloud.database()
const _   = db.command
const col = db.collection('shops')

const QUOTA_FREE = 10
const CACHE_TTL  = 30 * 60 * 1000

// ── 主入口 ────────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  const { action } = event
  switch (action) {
    case 'submit': return await actionSubmit(OPENID, event)
    case 'poll':   return await actionPoll(OPENID, event)
    case 'quota':  return await actionQuota(OPENID)
    default:       return { success: false, error: 'unknown_action' }
  }
}

// ── submit：发起生成，立即返回 task_id ────────────────────
async function actionSubmit(openid, event) {
  const { goal = '高利润', flavor = '果味' } = event
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop = shops[0]
    const isPro = shop.plan === 'pro'
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

    // 缓存命中直接返回
    const cacheKey = `${goal}_${flavor}_${_dateStr(now)}`
    const cached   = shop.aiMenuCache && shop.aiMenuCache[cacheKey]
    if (cached && (now - cached.ts) < CACHE_TTL) {
      return {
        success: true, fromCache: true,
        cocktails:      cached.cocktails,
        quotaUsed:      currentUsed,
        quotaRemaining: isPro ? null : QUOTA_FREE - currentUsed,
      }
    }

    // 读取库存
    const { data: ingredients } = await db.collection('ingredients')
      .where({ _openid: openid }).limit(100).get()
    const inventorySnapshot = ingredients.map(i => ({
      name: i.name, cat: i.cat, stock: i.stock, unit: i.unit,
      threshold: i.threshold, costPerUnit: i.costPerUnit, status: i.status,
    }))

    // 发起 Dify streaming，读到 task_id 后立即返回
    const taskId = await submitToStreaming({ goal, flavor, shopName: shop.name || '酒吧', inventorySnapshot })

    // 存 pending 任务（含库存快照，poll 时用于解析结果）
    await col.doc(shop._id).update({
      data: {
        [`aiPendingTask.${taskId}`]: {
          openid, goal, flavor, cacheKey, inventorySnapshot, startedAt: now,
        }
      }
    })

    return { success: true, fromCache: false, taskId, quotaUsed: currentUsed }

  } catch (e) {
    console.error('[actionSubmit]', e)
    return { success: false, error: e.message || 'internal_error' }
  }
}

// ── poll：查询任务结果 ─────────────────────────────────────
async function actionPoll(openid, event) {
  const { taskId } = event
  if (!taskId) return { success: false, error: 'taskId_required' }
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop    = shops[0]
    const pending = shop.aiPendingTask && shop.aiPendingTask[taskId]
    if (!pending) return { success: false, error: 'task_not_found' }

    // 检查结果是否已写入
    const result = shop.aiTaskResult && shop.aiTaskResult[taskId]
    if (!result) {
      return { success: true, status: 'pending' }
    }

    // 有结果：扣配额、写缓存、清理临时数据
    const isPro     = shop.plan === 'pro'
    const now       = Date.now()
    const cocktails = result.cocktails || []

    await col.doc(shop._id).update({
      data: {
        aiQuotaUsed: _.inc(1),
        [`aiMenuCache.${pending.cacheKey}`]: { ts: now, cocktails },
        [`aiPendingTask.${taskId}`]: db.command.remove(),
        [`aiTaskResult.${taskId}`]:  db.command.remove(),
      }
    })

    const quotaUsed = (shop.aiQuotaUsed || 0) + 1
    return {
      success: true, status: 'done',
      cocktails,
      quotaUsed,
      quotaRemaining: isPro ? null : Math.max(0, QUOTA_FREE - quotaUsed),
    }
  } catch (e) {
    console.error('[actionPoll]', e)
    return { success: false, error: e.message }
  }
}

// ── quota ─────────────────────────────────────────────────
async function actionQuota(openid) {
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop = shops[0]
    const isPro = shop.plan === 'pro'
    const quotaUsed = shop.aiQuotaUsed || 0
    return {
      success: true, plan: shop.plan || 'free', quotaUsed,
      quotaLimit:     isPro ? null : QUOTA_FREE,
      quotaRemaining: isPro ? null : Math.max(0, QUOTA_FREE - quotaUsed),
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── submitToStreaming：发起 SSE 流，拿到 task_id 即返回 ───
// 同时继续在后台读完整流，结束后把结果写入 shops.aiTaskResult
async function submitToStreaming({ goal, flavor, shopName, inventorySnapshot }) {
  const API_KEY  = process.env.DIFY_API_KEY || ''
  const BASE_URL = (process.env.DIFY_API_URL || 'https://api.dify.ai/v1').replace(/\/$/, '')
  if (!API_KEY) throw new Error('DIFY_API_KEY not configured')

  const lowStock = inventorySnapshot.filter(i => i.status !== 'ok')
  const allNames = inventorySnapshot.map(i => i.name).join('、')

  const bodyStr = JSON.stringify({
    inputs: {
      goal, flavor,
      shop_name:       shopName,
      all_ingredients: allNames,
      low_stock_items: JSON.stringify(lowStock.map(i => ({
        name: i.name, stock: i.stock, unit: i.unit,
        threshold: i.threshold, status: i.status,
      }))),
      output_format: 'json',
    },
    query:           '请根据以上库存信息生成酒单',
    response_mode:   'streaming',
    conversation_id: '',
    user:            'bacchus-cloud',
  })

  return new Promise((resolve, reject) => {
    const urlObj  = new URL(`${BASE_URL}/chat-messages`)
    const req = https.request({
      hostname: urlObj.hostname,
      port:     urlObj.port || 443,
      path:     urlObj.pathname,
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${API_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let taskId     = null
      let fullAnswer = ''
      let resolved   = false
      let buf        = ''

      res.on('data', chunk => {
        buf += chunk.toString()
        const lines = buf.split('\n')
        buf = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const json = JSON.parse(raw)

            // 拿到 task_id 立刻 resolve（让云函数快速返回）
            if (json.task_id && !taskId) {
              taskId = json.task_id
              if (!resolved) { resolved = true; resolve(taskId) }
            }

            // 累积 answer 文本
            if (json.event === 'message' && json.answer) {
              fullAnswer += json.answer
            }

            // 流结束事件：写结果到数据库
            if (json.event === 'message_end' && taskId) {
              const cocktails = parseAIOutput(fullAnswer, inventorySnapshot)
              _writeTaskResult(taskId, cocktails)
                .catch(e => console.error('[writeTaskResult]', e))
            }

          } catch (_) {}
        }
      })

      res.on('end', () => {
        if (!resolved) reject(new Error('stream ended without task_id'))
        // 兜底：流结束时还没写结果，用累积的 fullAnswer 补写
        if (taskId && fullAnswer) {
          const cocktails = parseAIOutput(fullAnswer, inventorySnapshot)
          _writeTaskResult(taskId, cocktails)
            .catch(e => console.error('[writeTaskResult end]', e))
        }
      })
      res.on('error', e => { if (!resolved) reject(e) })
    })

    req.on('error', e => { if (!resolved) reject(e) })
    req.setTimeout(15000, () => {
      // 15秒内没拿到 task_id 才算超时，已 resolve 则继续读流
      if (!resolved) { req.destroy(); reject(new Error('no task_id within 15s')) }
    })
    req.write(bodyStr)
    req.end()
  })
}

// ── _writeTaskResult：把结果写回数据库（供 poll 读取） ────
async function _writeTaskResult(taskId, cocktails) {
  // 通过 aiPendingTask 字段找到对应店铺
  const { data: shops } = await col
    .where({ [`aiPendingTask.${taskId}`]: db.command.exists(true) })
    .limit(1).get()
  if (!shops.length) {
    console.warn('[writeTaskResult] shop not found for taskId:', taskId)
    return
  }
  await col.doc(shops[0]._id).update({
    data: { [`aiTaskResult.${taskId}`]: { cocktails, savedAt: Date.now() } }
  })
  console.log('[writeTaskResult] saved', cocktails.length, 'cocktails for task', taskId)
}

// ── parseAIOutput ─────────────────────────────────────────
function parseAIOutput(text, inventorySnapshot) {
  if (!text) return []
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    let parsed = JSON.parse(cleaned)
    if (parsed && !Array.isArray(parsed)) {
      parsed = parsed.cocktails || parsed.data || parsed.result || []
    }
    if (!Array.isArray(parsed)) return []
    const stockMap = {}
    inventorySnapshot.forEach(i => { stockMap[i.name] = i })
    return parsed.slice(0, 4).map((item, idx) => ({
      emoji:          item.emoji          || '🍸',
      name:           item.name           || `推荐酒款 ${idx + 1}`,
      matchScore:     Number(item.matchScore)     || 80,
      matchLevel:     matchLevel(Number(item.matchScore) || 80),
      costEstimate:   Number(item.costEstimate)   || 0,
      suggestedPrice: Number(item.suggestedPrice) || 0,
      grossMargin:    Number(item.grossMargin)    || 0,
      substitute:     item.substitute             || null,
      ingredients:    (item.ingredients || []).map(ing => ({
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

function matchLevel(s) { return s >= 80 ? 'ok' : s >= 60 ? 'warn' : 'danger' }
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
