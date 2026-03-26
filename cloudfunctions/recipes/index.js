// cloudfunctions/recipes/index.js
// 云函数：recipes  —  用户配方 + 收藏 + 合集 CRUD + AI 生成（Dify 工作流）
//
// 集合：recipes（每条文档 = 一个用户配方）
//       collections（每条文档 = 一个合集）
//
// Actions:
//   list         - 获取我的配方列表（含收藏标记）
//   get          - 获取单个配方详情
//   add          - 新增配方
//   update       - 更新配方
//   remove       - 删除配方
//   toggleFav    - 切换收藏（写到 shops.favRecipeIds）
//   getFavIds    - 获取收藏 ID 集合
//   collList     - 获取合集列表
//   collAdd      - 新建合集
//   collUpdate   - 更新合集
//   collRemove   - 删除合集
//   collToggle   - 向合集添加/移除配方
//   aiGenerate   - AI 生成配方（Dify 工作流）
//   aiQuota      - 查询 AI 配方剩余次数

const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db   = cloud.database()
const _    = db.command
const rCol = db.collection('recipes')
const cCol = db.collection('collections')
const sCol = db.collection('shops')
const iCol = db.collection('recipe_images')
const pCol = db.collection('public_recipes')

const RECIPE_QUOTA_FREE = 5

// ── 主入口 ────────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  const { action } = event

  switch (action) {
    case 'list':        return await actionList(OPENID, event)
    case 'get':         return await actionGet(OPENID, event.id)
    case 'add':         return await actionAdd(OPENID, event.payload)
    case 'update':      return await actionUpdate(OPENID, event.id, event.payload)
    case 'remove':      return await actionRemove(OPENID, event.id)
    case 'toggleFav':   return await actionToggleFav(OPENID, event.id)
    case 'getFavIds':   return await actionGetFavIds(OPENID)
    case 'collList':    return await actionCollList(OPENID)
    case 'collAdd':     return await actionCollAdd(OPENID, event.payload)
    case 'collUpdate':  return await actionCollUpdate(OPENID, event.id, event.payload)
    case 'collRemove':  return await actionCollRemove(OPENID, event.id)
    case 'collToggle':  return await actionCollToggle(OPENID, event.collId, event.recipeId)
    case 'aiGenerate':  return await actionAIGenerate(OPENID, event)
    case 'aiQuota':     return await actionAIQuota(OPENID)
    // ── recipe_images 集合操作 ────────────────────────────
    case 'imageList':      return await actionImageList(OPENID, event)
    case 'imageSetCover':  return await actionImageSetCover(OPENID, event)
    case 'imageDelete':    return await actionImageDelete(OPENID, event)
    case 'imageCoverMap':  return await actionImageCoverMap(OPENID)
    // ── public_recipes 集合操作 ──────────────────────────
    case 'discoverList':      return await actionDiscoverList(OPENID, event)
    case 'discoverPublish':   return await actionDiscoverPublish(OPENID, event)
    case 'discoverUnpublish': return await actionDiscoverUnpublish(OPENID, event)
    case 'discoverLike':      return await actionDiscoverLike(OPENID, event)
    case 'discoverGetLiked':  return await actionDiscoverGetLiked(OPENID)
    // ── 合集发布 / 克隆 ──────────────────────────────────
    case 'collPublish':   return await actionCollPublish(OPENID, event)
    case 'collUnpublish': return await actionCollUnpublish(OPENID, event)
    case 'collClone':     return await actionCollClone(OPENID, event)
    // ── 合集收藏 ─────────────────────────────────────────
    case 'toggleFavColl':  return await actionToggleFavColl(OPENID, event.id)
    case 'getFavCollIds':  return await actionGetFavCollIds(OPENID)
    case 'favCollList':    return await actionFavCollList(OPENID)
    // ── 配方详情页互动 ────────────────────────────────────
    case 'detailGet':         return await actionDetailGet(OPENID, event.publicId)
    case 'detailRate':        return await actionDetailRate(OPENID, event.publicId, event.score)
    case 'detailComment':     return await actionDetailComment(OPENID, event.publicId, event.content)
    case 'detailCommentList': return await actionDetailCommentList(OPENID, event.publicId, event.lastId, event.limit)
    case 'detailTagVote':     return await actionDetailTagVote(OPENID, event.publicId, event.tags)
    default:            return { success: false, error: 'unknown_action' }
  }
}

// ── list：获取用户配方列表 ────────────────────────────────
async function actionList(openid, event) {
  const { search = '', base = '' } = event
  try {
    let query = rCol.where({ _openid: openid })
    const { data } = await query.orderBy('createdAt', 'desc').limit(200).get()

    // 客户端过滤（数据量小，不值得复杂查询）
    let list = data
    if (base && base !== '全部') {
      if (base === '其他') {
        const known = ['金酒','伏特加','朗姆酒','龙舌兰','威士忌','无酒精']
        list = list.filter(r => !known.includes(r.base))
      } else {
        list = list.filter(r => r.base === base)
      }
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.name.includes(q) || (r.base||'').includes(q) ||
        (r.ingredients||[]).some(i => i.name.includes(q))
      )
    }

    // 获取收藏 ID
    const favIds = await _getFavIds(openid)

    return {
      success: true,
      data: list.map(r => _normalizeRecipe(r, favIds)),
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── get：单个配方详情 ─────────────────────────────────────
async function actionGet(openid, id) {
  try {
    const { data: r } = await rCol.doc(id).get()
    if (!r || r._openid !== openid) return { success: false, error: 'not_found' }
    const favIds = await _getFavIds(openid)
    return { success: true, data: _normalizeRecipe(r, favIds) }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── add：新增配方 ─────────────────────────────────────────
async function actionAdd(openid, payload) {
  try {
    const now  = Date.now()
    const data = {
      _openid:     openid,
      name:        payload.name        || '未命名',
      emoji:       payload.emoji       || '🍹',
      base:        payload.base        || '',
      style:       payload.style       || '',
      abv:         Number(payload.abv) || 0,
      desc:        payload.desc        || '',
      ingredients: payload.ingredients || [],
      steps:       payload.steps       || [],
      notes:       payload.notes       || '',
      isAI:        !!payload.isAI,
      isClone:     !!payload.isClone,
      isOriginal:  !!payload.isAI || !!payload.isClone ? false : !!payload.isOriginal,
      createdAt:   now,
      updatedAt:   now,
    }
    const { _id } = await rCol.add({ data })
    return { success: true, id: _id, data: { _id, ...data } }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── update：更新配方 ──────────────────────────────────────
async function actionUpdate(openid, id, payload) {
  try {
    const { data: r } = await rCol.doc(id).get()
    if (!r || r._openid !== openid) return { success: false, error: 'not_found' }
    const patch = {
      name:        payload.name,
      emoji:       payload.emoji,
      base:        payload.base,
      style:       payload.style,
      abv:         Number(payload.abv) || 0,
      desc:        payload.desc,
      ingredients: payload.ingredients,
      steps:       payload.steps,
      notes:       payload.notes,
      coverImage:  payload.coverImage,   // 云存储 fileID，AI 生图后写入
      updatedAt:   Date.now(),
    }
    // isOriginal 仅允许在非AI、非克隆配方上修改
    if (payload.isOriginal !== undefined && !r.isAI && !r.isClone) {
      patch.isOriginal = !!payload.isOriginal
    }
    // 去掉 undefined
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k])
    await rCol.doc(id).update({ data: patch })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── remove：删除配方 ──────────────────────────────────────
async function actionRemove(openid, id) {
  try {
    const { data: r } = await rCol.doc(id).get()
    if (!r || r._openid !== openid) return { success: false, error: 'not_found' }
    await rCol.doc(id).remove()

    // 同步：从所有合集中移除该配方 ID
    const { data: colls } = await cCol.where({ _openid: openid }).get()
    for (const c of colls) {
      if ((c.recipeIds || []).includes(id)) {
        await cCol.doc(c._id).update({
          data: { recipeIds: c.recipeIds.filter(rid => rid !== id) }
        })
      }
    }

    // 同步：从收藏中移除
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    if (shop) {
      const favIds = shop.favRecipeIds || {}
      if (favIds[id]) {
        delete favIds[id]
        await sCol.doc(shop._id).update({ data: { favRecipeIds: favIds } })
      }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── toggleFav：切换收藏 ───────────────────────────────────
async function actionToggleFav(openid, id) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    if (!shop) return { success: false, error: 'shop_not_found' }
    const favIds = shop.favRecipeIds || {}
    const isFav  = !!favIds[id]
    if (isFav) {
      delete favIds[id]
    } else {
      favIds[id] = true
    }
    await sCol.doc(shop._id).update({ data: { favRecipeIds: favIds } })
    return { success: true, isFav: !isFav, favIds }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── getFavIds ─────────────────────────────────────────────
async function actionGetFavIds(openid) {
  try {
    const favIds = await _getFavIds(openid)
    return { success: true, favIds }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── collList：获取合集列表（含配方详情）──────────────────
async function actionCollList(openid) {
  try {
    const { data: colls } = await cCol
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    // 批量拉取配方详情
    const allIds = [...new Set(colls.flatMap(c => c.recipeIds || []))]
    const recipeMap = {}
    if (allIds.length > 0) {
      // 分批查（每次最多 20 个）
      for (let i = 0; i < allIds.length; i += 20) {
        const batch = allIds.slice(i, i + 20)
        const { data } = await rCol
          .where({ _id: _.in(batch), _openid: openid })
          .get()
        data.forEach(r => { recipeMap[r._id] = r })
      }
    }

    // 批量拉取合集相关的封面图（isCover=true 的 recipe_images）
    const iCol = db.collection('recipe_images')
    const allCollIds = colls.map(c => c._id).filter(Boolean)
    const coverMap = {}   // targetId → fileID
    if (allCollIds.length > 0) {
      try {
        const { data: coverImgs } = await iCol
          .where({ _openid: openid, targetType: 'collection', isCover: true })
          .field({ targetId: true, fileID: true })
          .limit(200)
          .get()
        coverImgs.forEach(img => { coverMap[img.targetId] = img.fileID })
      } catch (_) {}
    }

    const list = colls.map(c => ({
      ...c,
      id:          c._id,
      count:       (c.recipeIds || []).length,
      coverFileID: coverMap[c._id] || c.coverImage || '',   // 优先用 recipe_images 封面
      recipes: (c.recipeIds || []).map(rid => {
        if (!recipeMap[rid]) return { _id: rid, id: rid, name: '已删除' }
        const r = _normalizeRecipe(recipeMap[rid], {})
        // 附带配方封面 fileID（用于合集内配方缩略图）
        return { ...r, coverFileID: r.coverImage || '' }
      }),
    }))

    return { success: true, data: list }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── collAdd ───────────────────────────────────────────────
async function actionCollAdd(openid, payload) {
  try {
    const now  = Date.now()
    const data = {
      _openid:   openid,
      name:      payload.name  || '新合集',
      emoji:     payload.emoji || '📂',
      desc:      payload.desc  || '',
      tags:      (payload.tags || []).slice(0, 5),
      recipeIds: [],
      createdAt: now,
    }
    const { _id } = await cCol.add({ data })
    return { success: true, id: _id, data: { _id, ...data } }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── collUpdate ────────────────────────────────────────────
async function actionCollUpdate(openid, id, payload) {
  try {
    const { data: c } = await cCol.doc(id).get()
    if (!c || c._openid !== openid) return { success: false, error: 'not_found' }
    const patch = {}
    if (payload.name        !== undefined) patch.name        = payload.name
    if (payload.emoji       !== undefined) patch.emoji       = payload.emoji
    if (payload.desc        !== undefined) patch.desc        = payload.desc
    if (payload.tags        !== undefined) patch.tags        = (payload.tags || []).slice(0, 5)
    if (payload.coverImage  !== undefined) patch.coverImage  = payload.coverImage  // AI 生图写入
    await cCol.doc(id).update({ data: patch })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── collRemove ────────────────────────────────────────────
async function actionCollRemove(openid, id) {
  try {
    const { data: c } = await cCol.doc(id).get()
    if (!c || c._openid !== openid) return { success: false, error: 'not_found' }
    await cCol.doc(id).remove()
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── collToggle：添加/移除配方到合集 ──────────────────────
async function actionCollToggle(openid, collId, recipeId) {
  try {
    const { data: c } = await cCol.doc(collId).get()
    if (!c || c._openid !== openid) return { success: false, error: 'not_found' }
    const ids    = c.recipeIds || []
    const isIn   = ids.includes(recipeId)
    const newIds = isIn ? ids.filter(id => id !== recipeId) : [...ids, recipeId]
    await cCol.doc(collId).update({ data: { recipeIds: newIds } })
    return { success: true, isIn: !isIn }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── aiGenerate：调用 Dify 工作流生成配方 ─────────────────
async function actionAIGenerate(openid, event) {
  const { flavors = [], base = '随机', note = '' } = event
  try {
    // 配额检查
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    if (!shop) return { success: false, error: 'shop_not_found' }

    const isPro     = shop.plan === 'pro'
    const now       = Date.now()
    const needsReset = _needsMonthlyReset(shop.recipeAiQuotaReset || 0, now)
    let currentUsed  = needsReset ? 0 : (shop.recipeAiQuotaUsed || 0)
    if (needsReset) {
      await sCol.doc(shop._id).update({ data: { recipeAiQuotaUsed: 0, recipeAiQuotaReset: now } })
    }
    if (!isPro && currentUsed >= RECIPE_QUOTA_FREE) {
      return { success: false, error: 'quota_exceeded', quotaUsed: currentUsed, quotaLimit: RECIPE_QUOTA_FREE }
    }

    // 调用 Dify
    const difyResult = await callDifyWorkflow({ flavors, base, note })
    if (!difyResult.success) return { success: false, error: difyResult.error || 'ai_error' }

    // 扣减配额
    await sCol.doc(shop._id).update({ data: { recipeAiQuotaUsed: _.inc(1) } })
    currentUsed++

    return {
      success:        true,
      recipe:         difyResult.recipe,
      quotaUsed:      currentUsed,
      quotaRemaining: isPro ? null : RECIPE_QUOTA_FREE - currentUsed,
    }
  } catch (e) {
    console.error('[recipes] aiGenerate error:', e)
    return { success: false, error: e.message || 'internal_error' }
  }
}

// ── aiQuota ───────────────────────────────────────────────
async function actionAIQuota(openid) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    if (!shop) return { success: false, error: 'shop_not_found' }
    const isPro     = shop.plan === 'pro'
    const quotaUsed = shop.recipeAiQuotaUsed || 0
    return {
      success:        true,
      quotaUsed,
      quotaLimit:     isPro ? null : RECIPE_QUOTA_FREE,
      quotaRemaining: isPro ? null : Math.max(0, RECIPE_QUOTA_FREE - quotaUsed),
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── callDifyWorkflow：/workflows/run ──────────────────────
async function callDifyWorkflow({ flavors, base, note }) {
  const API_KEY  = process.env.DIFY_API_KEY || ''
  const BASE_URL = (process.env.DIFY_API_URL || 'https://api.dify.ai/v1').replace(/\/$/, '')
  if (!API_KEY) return { success: false, error: 'DIFY_API_KEY not configured' }

  const flavorStr = Array.isArray(flavors) ? flavors.join('、') : String(flavors || '')
  const body = JSON.stringify({
    inputs: {
      flavors:  flavorStr,
      base:     base  || '随机',
      note:     note  || '',
    },
    response_mode: 'blocking',
    user:          'bacchus-cloud',
  })

  try {
    const rawText = await httpsPost(`${BASE_URL}/workflows/run`, {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
    }, body)

    const res = JSON.parse(rawText)
    if (res.data && res.data.status === 'succeeded') {
      const out        = res.data.outputs || {}
      const outputText = out.result || out.text || out.output || Object.values(out)[0] || ''
      if (!outputText) return { success: false, error: 'empty_output_from_dify' }
      const recipe = parseRecipeOutput(outputText)
      return { success: true, recipe }
    }
    const errMsg = (res.data && res.data.error) || `status=${res.data && res.data.status}`
    return { success: false, error: `dify_error: ${errMsg}` }
  } catch (e) {
    console.error('[callDifyWorkflow]', e)
    return { success: false, error: e.message }
  }
}

function parseRecipeOutput(text) {
  if (!text) return null
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    return {
      emoji:       parsed.emoji       || '🍸',
      name:        parsed.name        || '未命名配方',
      base:        parsed.base        || '',
      style:       parsed.style       || '',
      abv:         Number(parsed.abv) || 0,
      desc:        parsed.desc        || '',
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map(i => ({ name: String(i.name||''), amount: String(i.amount||'') }))
        : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
      notes: parsed.notes || '',
      isAI:  true,
    }
  } catch (e) {
    console.error('[parseRecipeOutput]', e.message)
    return null
  }
}

// ── imageList：查询某 target 的所有图片（按时间倒序）────────
// event: { targetType, targetId }
// 返回: { data: [{ _id, fileID, style, isCover, createdAt }] }
async function actionImageList(openid, event) {
  const { targetType, targetId } = event
  if (!targetId) return { success: false, error: 'targetId_required' }
  try {
    const { data } = await iCol
      .where({ _openid: openid, targetType, targetId })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── imageSetCover：将某张图设为封面 ─────────────────────────
// event: { imageId, targetId, targetType }
async function actionImageSetCover(openid, event) {
  const { imageId, targetId, targetType } = event
  if (!imageId || !targetId) return { success: false, error: 'imageId and targetId required' }
  try {
    // 先把该 target 所有图片的 isCover 设为 false
    await iCol
      .where({ _openid: openid, targetId, isCover: true })
      .update({ data: { isCover: false } })
    // 再把目标图片设为 true
    await iCol.doc(imageId).update({ data: { isCover: true } })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── imageDelete：删除一条图片记录 ───────────────────────────
// event: { imageId, targetId, targetType }
// 注意：只删数据库记录，不删云存储文件（留给用户手动清理或定时任务）
async function actionImageDelete(openid, event) {
  const { imageId, targetId } = event
  if (!imageId) return { success: false, error: 'imageId_required' }
  try {
    const { data: img } = await iCol.doc(imageId).get()
    if (!img || img._openid !== openid) return { success: false, error: 'not_found' }

    await iCol.doc(imageId).remove()

    // 如果删的是封面图，自动把最新一张设为封面
    if (img.isCover && targetId) {
      const { data: remaining } = await iCol
        .where({ _openid: openid, targetId })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      if (remaining.length > 0) {
        await iCol.doc(remaining[0]._id).update({ data: { isCover: true } })
      }
    }
    return { success: true, wascover: img.isCover }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── imageCoverMap：返回当前用户所有封面图的 targetId→fileID 映射 ──
// 供 myRecipes.js preload 时一次性拉取，避免多次调用
async function actionImageCoverMap(openid) {
  try {
    const { data } = await iCol
      .where({ _openid: openid, isCover: true })
      .field({ targetId: true, fileID: true })
      .limit(100)
      .get()
    return {
      success: true,
      data: data.map(r => ({ targetId: r.targetId, fileID: r.fileID })),
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── 工具函数 ──────────────────────────────────────────────
async function _getFavIds(openid) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    return (shop && shop.favRecipeIds) || {}
  } catch (_) { return {} }
}

function _normalizeRecipe(r, favIds) {
  return {
    ...r,
    id:                r._id,
    isFav:             !!(favIds && favIds[r._id]),
    ingredientPreview: (r.ingredients || []).slice(0, 3),
    moreCount:         Math.max(0, (r.ingredients || []).length - 3),
  }
}

function _needsMonthlyReset(ts, now) {
  if (!ts) return true
  const r = new Date(ts), n = new Date(now)
  return r.getFullYear() < n.getFullYear() || r.getMonth() < n.getMonth()
}

function httpsPost(url, headers, body) {
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

// ════════════════════════════════════════════════════════════
// public_recipes 集合 — 发现页公开配方
// ════════════════════════════════════════════════════════════

// 预设标签（前端也维护同一份，保持一致）
const PRESET_TAGS = ['果味', '清爽', '低度', '经典', '创意', '烟熏', '花香', '热带', '夏日', '甜蜜', '苦涩', '无酒精']

// ── discoverList：分页查询公开配方 ────────────────────────
// event: { tag?, keyword?, lastId?, limit? }
// 权限：所有用户可读（集合权限已在控制台设置）
async function actionDiscoverList(openid, event) {
  const { tag = '', keyword = '', lastId = null, limit = 20, targetType = '' } = event
  try {
    // 构造 where 条件
    const buildWhere = (extraTs) => {
      const w = {}
      if (targetType && targetType !== 'all') w.targetType = targetType
      if (tag && tag !== '全部') w.tags = db.command.elemMatch(db.command.eq(tag))
      if (extraTs) w.publishedAt = db.command.lt(extraTs)
      return w
    }

    let query = pCol.where(buildWhere()).orderBy('publishedAt', 'desc')

    // 分页游标
    if (lastId) {
      const { data: lastDoc } = await pCol.doc(lastId).get()
      if (lastDoc) query = pCol.where(buildWhere(lastDoc.publishedAt)).orderBy('publishedAt', 'desc')
    }

    const { data } = await query.limit(limit + 1).get()

    const hasMore = data.length > limit
    const list    = data.slice(0, limit)

    // 标记当前用户是否已点赞（读 shops.likedPublicIds）
    let likedSet = {}
    try {
      const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
      if (shop && shop.likedPublicIds) {
        ;(shop.likedPublicIds || []).forEach(id => { likedSet[id] = true })
      }
    } catch (_) {}

    // 批量查询所有发布者的当前店铺名（实时，不用缓存的 authorName）
    // 关键词过滤（在名字解析后进行，以支持按作者名搜索）
    const authorOpenids = [...new Set(list.map(r => r.authorOpenid || r._openid).filter(Boolean))]
    const authorNameMap = {}
    if (authorOpenids.length > 0) {
      try {
        // 分批查询（每次最多 20 个）
        for (let i = 0; i < authorOpenids.length; i += 20) {
          const batch = authorOpenids.slice(i, i + 20)
          const { data: shops } = await sCol
            .where({ _openid: db.command.in(batch) })
            .field({ _openid: true, name: true })
            .get()
          shops.forEach(s => { authorNameMap[s._openid] = s.name || '酒吧' })
        }
      } catch (_) {}
    }

    const resolved = list.map(r => {
      const aOpenid = r.authorOpenid || r._openid || ''
      return { ...r, authorName: authorNameMap[aOpenid] || r.authorName || '酒吧' }
    })

    // 关键词在应用层过滤（此时 authorName 已是实时名，支持按作者名搜索）
    const filtered = keyword
      ? resolved.filter(r =>
          r.name.includes(keyword) ||
          (r.desc || '').includes(keyword) ||
          (r.tags || []).some(t => t.includes(keyword)) ||
          (r.authorName || '').includes(keyword)
        )
      : resolved

    const result = filtered.map(r => ({
      ...r,
      id:      r._id,
      isLiked: !!likedSet[r._id],
    }))

    return {
      success: true,
      data:    result,
      hasMore: hasMore && filtered.length >= limit,
      lastId:  list.length ? list[list.length - 1]._id : null,
    }
  } catch (e) {
    console.error('[discoverList]', e)
    return { success: false, error: e.message }
  }
}

// ── discoverPublish：发布配方到发现页 ─────────────────────
// event: { recipeId, tags[], coverFileID? }
// 从 recipes 集合读取配方数据，写入 public_recipes
async function actionDiscoverPublish(openid, event) {
  const { recipeId, tags = [], coverFileID = '' } = event
  if (!recipeId) return { success: false, error: 'recipeId_required' }
  try {
    // 读取原配方
    const { data: r } = await rCol.doc(recipeId).get()
    if (!r || r._openid !== openid) return { success: false, error: 'not_found' }

    // 已发布则更新（幂等）
    if (r.isPublic && r.publishId) {
      await pCol.doc(r.publishId).update({
        data: {
          tags,
          coverFileID: coverFileID || r.coverImage || '',
          name:        r.name,
          emoji:       r.emoji || '🍹',
          desc:        r.desc  || '',
          base:        r.base  || '',
          updatedAt:   Date.now(),
        }
      })
      return { success: true, publishId: r.publishId, isUpdate: true }
    }

    const now = Date.now()
    const { _id: publishId } = await pCol.add({
      data: {
        _openid:      openid,
        authorOpenid: openid,   // 存 openid，查询时实时读 shops.name
        targetType:   'recipe',
        targetId:    recipeId,
        name:        r.name,
        emoji:       r.emoji || '🍹',
        desc:        r.desc  || '',
        base:        r.base  || '',
        ingredients: (r.ingredients || []).slice(0, 10),  // 冗余存储，方便展示
        steps:       r.steps || [],
        notes:       r.notes || '',
        isAI:        !!r.isAI,
        tags:        tags.slice(0, 5),
        coverFileID: coverFileID || r.coverImage || '',
        likeCount:   0,
        publishedAt: now,
        updatedAt:   now,
      }
    })

    // 回写 isPublic + publishId 到原配方
    await rCol.doc(recipeId).update({
      data: { isPublic: true, publishId, updatedAt: now }
    })

    return { success: true, publishId, isUpdate: false }
  } catch (e) {
    console.error('[discoverPublish]', e)
    return { success: false, error: e.message }
  }
}

// ── discoverUnpublish：撤回发布 ───────────────────────────
// event: { recipeId, publishId }
async function actionDiscoverUnpublish(openid, event) {
  const { recipeId, publishId } = event
  if (!publishId) return { success: false, error: 'publishId_required' }
  try {
    // 验证归属
    const { data: pub } = await pCol.doc(publishId).get()
    if (!pub || pub._openid !== openid) return { success: false, error: 'not_found' }

    await pCol.doc(publishId).remove()

    // 回写原配方
    if (recipeId) {
      await rCol.doc(recipeId).update({
        data: { isPublic: false, publishId: null, updatedAt: Date.now() }
      })
    }
    return { success: true }
  } catch (e) {
    console.error('[discoverUnpublish]', e)
    return { success: false, error: e.message }
  }
}

// ── discoverLike：点赞 / 取消点赞 ─────────────────────────
// event: { publishId }
// 用 shops.likedPublicIds 数组记录已点赞（避免重复点赞）
async function actionDiscoverLike(openid, event) {
  const { publishId } = event
  if (!publishId) return { success: false, error: 'publishId_required' }
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    if (!shop) return { success: false, error: 'shop_not_found' }

    const liked    = (shop.likedPublicIds || [])
    const isLiked  = liked.includes(publishId)
    const newLiked = isLiked
      ? liked.filter(id => id !== publishId)
      : [...liked, publishId]

    // 原子操作：更新 likeCount
    await pCol.doc(publishId).update({
      data: { likeCount: _.inc(isLiked ? -1 : 1) }
    })

    // 更新 shops.likedPublicIds
    await sCol.doc(shop._id).update({
      data: { likedPublicIds: newLiked }
    })

    return { success: true, isLiked: !isLiked }
  } catch (e) {
    console.error('[discoverLike]', e)
    return { success: false, error: e.message }
  }
}

// ── discoverGetLiked：获取当前用户已点赞的 ID 列表 ────────
async function actionDiscoverGetLiked(openid) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    return {
      success: true,
      likedPublicIds: (shop && shop.likedPublicIds) || [],
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ════════════════════════════════════════════════════════════
// 合集发布 / 克隆
// ════════════════════════════════════════════════════════════

// ── collPublish：发布合集到发现页 ─────────────────────────
// event: { collId, tags[], posterFileID? }
async function actionCollPublish(openid, event) {
  const { collId, tags = [], posterFileID = '' } = event
  if (!collId) return { success: false, error: 'collId_required' }
  try {
    const { data: c } = await cCol.doc(collId).get()
    if (!c || c._openid !== openid) return { success: false, error: 'not_found' }

    // 读取前 6 条配方做冗余快照（供发现页展示缩略）
    const previewIds = (c.recipeIds || []).slice(0, 6)
    const recipeSnap = []
    if (previewIds.length > 0) {
      const { data: recs } = await rCol
        .where({ _id: _.in(previewIds), _openid: openid })
        .field({ _id: true, name: true, emoji: true, desc: true, base: true, coverImage: true })
        .get()
      // 同时拉配方的 recipe_images 封面
      const { data: covImgs } = await db.collection('recipe_images')
        .where({ _openid: openid, targetType: 'recipe', isCover: true,
                 targetId: _.in(previewIds) })
        .field({ targetId: true, fileID: true })
        .get()
      const imgMap = {}
      covImgs.forEach(img => { imgMap[img.targetId] = img.fileID })

      recs.forEach(r => recipeSnap.push({
        id:          r._id,
        name:        r.name,
        emoji:       r.emoji || '🍹',
        base:        r.base || '',
        coverFileID: imgMap[r._id] || r.coverImage || '',
      }))
    }

    // 读取合集封面 fileID
    let collCoverFileID = ''
    try {
      const { data: covArr } = await db.collection('recipe_images')
        .where({ _openid: openid, targetType: 'collection', targetId: collId, isCover: true })
        .field({ fileID: true }).limit(1).get()
      if (covArr.length > 0) collCoverFileID = covArr[0].fileID
    } catch (_) {}

    const now = Date.now()

    // 已发布则更新（幂等）
    if (c.isPublic && c.publishId) {
      await pCol.doc(c.publishId).update({
        data: {
          name:         c.name,
          emoji:        c.emoji || '📂',
          desc:         c.desc  || '',
          tags:         tags.slice(0, 5),
          recipes:      recipeSnap,
          recipeCount:  (c.recipeIds || []).length,
          coverFileID:  collCoverFileID || c.coverImage || '',
          posterFileID: posterFileID || '',
          updatedAt:    now,
        }
      })
      return { success: true, publishId: c.publishId, isUpdate: true }
    }

    const { _id: publishId } = await pCol.add({
      data: {
        _openid:      openid,
        authorOpenid: openid,
        targetType:   'collection',
        targetId:    collId,
        name:        c.name,
        emoji:       c.emoji || '📂',
        desc:        c.desc  || '',
        tags:        tags.slice(0, 5),
        recipes:     recipeSnap,
        recipeCount: (c.recipeIds || []).length,
        coverFileID: collCoverFileID || c.coverImage || '',
        posterFileID,
        likeCount:   0,
        publishedAt: now,
        updatedAt:   now,
      }
    })

    // 回写 isPublic + publishId 到合集
    await cCol.doc(collId).update({
      data: { isPublic: true, publishId, updatedAt: now }
    })

    return { success: true, publishId, isUpdate: false }
  } catch (e) {
    console.error('[collPublish]', e)
    return { success: false, error: e.message }
  }
}

// ── collUnpublish：撤回合集发布 ───────────────────────────
// event: { collId, publishId }
async function actionCollUnpublish(openid, event) {
  const { collId, publishId } = event
  if (!publishId) return { success: false, error: 'publishId_required' }
  try {
    const { data: pub } = await pCol.doc(publishId).get()
    if (!pub || pub._openid !== openid) return { success: false, error: 'not_found' }

    await pCol.doc(publishId).remove()

    if (collId) {
      await cCol.doc(collId).update({
        data: { isPublic: false, publishId: null, updatedAt: Date.now() }
      })
    }
    return { success: true }
  } catch (e) {
    console.error('[collUnpublish]', e)
    return { success: false, error: e.message }
  }
}

// ── collClone：克隆公开合集到当前用户 ────────────────────
// 步骤：把合集快照里的配方逐一复制到 recipes，再建合集关联
// event: { publishId }
async function actionCollClone(openid, event) {
  const { publishId } = event
  if (!publishId) return { success: false, error: 'publishId_required' }
  try {
    const { data: pub } = await pCol.doc(publishId).get()
    if (!pub) return { success: false, error: 'not_found' }
    if (pub._openid === openid) return { success: false, error: 'cannot_clone_own' }

    const now      = Date.now()
    const newIds   = []

    // 复制配方快照（只有 recipes 字段里的 6 条，够展示；
    // 如果要完整克隆则需要另行实现）
    for (const snap of (pub.recipes || [])) {
      // 读原配方完整数据（若可读）
      let recData = null
      try {
        const { data: orig } = await rCol.doc(snap.id).get()
        if (orig) recData = orig
      } catch (_) {}

      const payload = recData
        ? {
            name:        recData.name,
            emoji:       recData.emoji || '🍹',
            base:        recData.base  || '',
            desc:        recData.desc  || '',
            ingredients: recData.ingredients || [],
            steps:       recData.steps || [],
            notes:       recData.notes || '',
            isAI:        !!recData.isAI,
          }
        : {
            // 仅用快照中的字段
            name:  snap.name + '（克隆）',
            emoji: snap.emoji || '🍹',
            base:  snap.base  || '',
          }

      const { _id } = await rCol.add({
        data: {
          _openid:     openid,
          ...payload,
          ingredients: payload.ingredients || [],
          steps:       payload.steps || [],
          isOriginal:  false,
          isClone:     true,
          clonedFrom:  snap.id,
          createdAt:   now,
          updatedAt:   now,
        }
      })
      newIds.push(_id)
    }

    // 建新合集
    const { _id: newCollId } = await cCol.add({
      data: {
        _openid:     openid,
        name:        pub.name + '（克隆）',
        emoji:       pub.emoji || '📂',
        desc:        pub.desc  || '',
        tags:        pub.tags  || [],
        recipeIds:   newIds,
        clonedFrom:  pub.targetId,
        createdAt:   now,
      }
    })

    return { success: true, collId: newCollId, recipeCount: newIds.length }
  } catch (e) {
    console.error('[collClone]', e)
    return { success: false, error: e.message }
  }
}

// ── toggleFavColl：切换合集收藏 ───────────────────────────
// id = public_recipes._id (publishId)
async function actionToggleFavColl(openid, id) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    if (!shop) return { success: false, error: 'shop_not_found' }
    const favCollIds = shop.favCollIds || {}
    const isFav      = !!favCollIds[id]
    if (isFav) delete favCollIds[id]
    else favCollIds[id] = true
    await sCol.doc(shop._id).update({ data: { favCollIds } })
    return { success: true, isFav: !isFav, favCollIds }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── getFavCollIds：获取合集收藏 ID 集合 ──────────────────
async function actionGetFavCollIds(openid) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    return { success: true, favCollIds: (shop && shop.favCollIds) || {} }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── favCollList：获取收藏的合集列表（从 public_recipes）──
async function actionFavCollList(openid) {
  try {
    const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
    const favCollIds = (shop && shop.favCollIds) || {}
    const ids = Object.keys(favCollIds)
    if (ids.length === 0) return { success: true, data: [] }

    // 批量查询（每次最多 20 条，云数据库 where in 限制）
    const results = []
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20)
      const { data } = await pCol.where({ _id: _.in(batch) }).get()
      results.push(...data)
    }

    // 查询作者昵称（去重 openid）
    const authorOpenids = [...new Set(results.map(r => r.authorOpenid).filter(Boolean))]
    const nameMap = {}
    if (authorOpenids.length) {
      const { data: shops } = await sCol.where({ _openid: _.in(authorOpenids) }).field({ _openid: true, shopName: true }).get()
      shops.forEach(s => { nameMap[s._openid] = s.shopName || '匿名小馆' })
    }

    return {
      success: true,
      data: results.map(r => ({
        ...r,
        authorName: nameMap[r.authorOpenid] || '匿名小馆',
        isFavColl:  true,
      })),
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ════════════════════════════════════════════════════════════
// 配方详情页互动：评分、评论、标签投票
// 集合：recipe_ratings   { publicId, _openid, score }
//       recipe_comments  { publicId, _openid, content, createdAt }（所有人可读）
//       recipe_tagvotes  { publicId, _openid, tags[] }
// 聚合写入 public_recipes: { ratingSum, ratingCount, ratingDist, tagVotes, commentCount }
// ════════════════════════════════════════════════════════════

function _fmtTs(ts) {
  if (!ts) return ''
  const d   = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000)  return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff/60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff/3600000)} 小时前`
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${m}-${day}`
}

// ── detailGet：获取公开配方详情 + 自己的评分/标签 + 首页评论 ──
async function actionDetailGet(openid, publicId) {
  if (!publicId) return { success: false, error: 'publicId_required' }
  try {
    // 1. 读 public_recipes
    const { data: pub } = await pCol.doc(publicId).get()
    if (!pub) return { success: false, error: 'not_found' }

    // 2. 若是合集，补全配方详情（public_recipes 只存快照，需从 recipes 集合重新拉）
    if (pub.targetType === 'collection' && pub.recipes && pub.recipes.length > 0) {
      const recipeIds = pub.recipes.map(r => r.id).filter(Boolean)
      if (recipeIds.length > 0) {
        try {
          const { data: fullRecs } = await rCol.where({ _id: _.in(recipeIds) }).get()
          const fullMap = {}
          fullRecs.forEach(r => { fullMap[r._id] = r })
          pub.recipes = pub.recipes.map(snap => {
            const full = fullMap[snap.id]
            if (!full) return snap
            return {
              ...snap,
              desc:        full.desc        || '',
              ingredients: full.ingredients || [],
              steps:       full.steps       || [],
              notes:       full.notes       || '',
            }
          })
        } catch (_) {}
      }
    }

    // 3. 作者名
    let authorName = pub.authorName || '酒吧'
    try {
      const { data: [shop] } = await sCol.where({ _openid: pub.authorOpenid || pub._openid }).limit(1).get()
      if (shop) authorName = shop.name || shop.shopName || authorName
    } catch (_) {}

    // 3. 当前用户是否已点赞
    let isLiked = false
    try {
      const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
      isLiked = !!(shop && (shop.likedPublicIds || []).includes(publicId))
    } catch (_) {}

    // 4. 我的评分
    let myRating = 0
    try {
      const { data: [r] } = await db.collection('recipe_ratings')
        .where({ publicId, _openid: openid }).limit(1).get()
      if (r) myRating = r.score || 0
    } catch (_) {}

    // 5. 我的标签投票
    let myTags = []
    try {
      const { data: [tv] } = await db.collection('recipe_tagvotes')
        .where({ publicId, _openid: openid }).limit(1).get()
      if (tv) myTags = tv.tags || []
    } catch (_) {}

    // 6. 首屏评论（最新 10 条）
    let comments = []
    let commentHasMore = false
    let commentLastId = null
    try {
      const { data: cDocs } = await db.collection('recipe_comments')
        .where({ publicId })
        .orderBy('createdAt', 'desc')
        .limit(10).get()
      // 批量拉评论者名字
      const cOpenids = [...new Set(cDocs.map(c => c._openid).filter(Boolean))]
      const cNameMap = {}
      if (cOpenids.length) {
        for (let i = 0; i < cOpenids.length; i += 20) {
          const { data: cs } = await sCol.where({ _openid: _.in(cOpenids.slice(i, i+20)) })
            .field({ _openid: true, name: true, shopName: true }).get()
          cs.forEach(s => { cNameMap[s._openid] = s.name || s.shopName || '酒客' })
        }
      }
      comments = cDocs.map(c => ({
        _id:        c._id,
        content:    c.content,
        authorName: cNameMap[c._openid] || '酒客',
        createdAtStr: _fmtTs(c.createdAt),
      }))
      commentHasMore = cDocs.length === 10
      commentLastId  = cDocs.length ? cDocs[cDocs.length - 1]._id : null
    } catch (_) {}

    return {
      success: true,
      recipe: { ...pub, authorName },
      isLiked,
      myRating,
      myTags,
      comments,
      commentHasMore,
      commentLastId,
    }
  } catch (e) {
    console.error('[detailGet]', e)
    return { success: false, error: e.message }
  }
}

// ── detailRate：提交/更新评分（1-5）────────────────────────
async function actionDetailRate(openid, publicId, score) {
  score = Math.max(1, Math.min(5, parseInt(score) || 1))
  if (!publicId) return { success: false, error: 'publicId_required' }
  try {
    const ratCol = db.collection('recipe_ratings')

    // 读旧评分
    const { data: [old] } = await ratCol.where({ publicId, _openid: openid }).limit(1).get()
    const oldScore = old ? (old.score || 0) : 0

    if (oldScore === score) return { success: true, noChange: true }

    // 写 recipe_ratings
    if (old) {
      await ratCol.doc(old._id).update({ data: { score, updatedAt: Date.now() } })
    } else {
      await ratCol.add({ data: { publicId, _openid: openid, score, createdAt: Date.now() } })
    }

    // 原子更新 public_recipes 聚合字段
    const distPatch = {}
    if (oldScore > 0) distPatch[`ratingDist.${oldScore}`] = _.inc(-1)
    distPatch[`ratingDist.${score}`] = _.inc(1)
    distPatch['ratingSum']   = _.inc(score - oldScore)
    distPatch['ratingCount'] = _.inc(oldScore === 0 ? 1 : 0)
    await pCol.doc(publicId).update({ data: distPatch })

    // 读最新聚合
    const { data: updated } = await pCol.doc(publicId).get()
    return {
      success: true,
      ratingSum:   updated.ratingSum   || 0,
      ratingCount: updated.ratingCount || 0,
      ratingDist:  updated.ratingDist  || {},
    }
  } catch (e) {
    console.error('[detailRate]', e)
    return { success: false, error: e.message }
  }
}

// ── detailComment：发表评论 ────────────────────────────────
async function actionDetailComment(openid, publicId, content) {
  content = (content || '').trim().slice(0, 500)
  if (!publicId) return { success: false, error: 'publicId_required' }
  if (!content)  return { success: false, error: 'empty_content' }
  try {
    // 获取评论者名字
    let authorName = '酒客'
    try {
      const { data: [shop] } = await sCol.where({ _openid: openid }).limit(1).get()
      if (shop) authorName = shop.name || shop.shopName || authorName
    } catch (_) {}

    const now = Date.now()
    const res = await db.collection('recipe_comments').add({
      data: { publicId, _openid: openid, content, createdAt: now }
    })

    // 更新 commentCount
    await pCol.doc(publicId).update({ data: { commentCount: _.inc(1) } })

    return {
      success: true,
      comment: {
        _id:          res._id,
        content,
        authorName,
        createdAtStr: '刚刚',
      }
    }
  } catch (e) {
    console.error('[detailComment]', e)
    return { success: false, error: e.message }
  }
}

// ── detailCommentList：分页评论 ───────────────────────────
async function actionDetailCommentList(openid, publicId, lastId, limit) {
  limit = Math.min(limit || 10, 20)
  if (!publicId) return { success: false, error: 'publicId_required' }
  try {
    let query = db.collection('recipe_comments').where({ publicId }).orderBy('createdAt', 'desc')
    if (lastId) {
      try {
        const { data: last } = await db.collection('recipe_comments').doc(lastId).get()
        if (last) query = db.collection('recipe_comments')
          .where({ publicId, createdAt: _.lt(last.createdAt) })
          .orderBy('createdAt', 'desc')
      } catch (_) {}
    }
    const { data: cDocs } = await query.limit(limit + 1).get()
    const hasMore = cDocs.length > limit
    const docs    = cDocs.slice(0, limit)

    const cOpenids = [...new Set(docs.map(c => c._openid).filter(Boolean))]
    const cNameMap = {}
    if (cOpenids.length) {
      const { data: shops } = await sCol.where({ _openid: _.in(cOpenids) })
        .field({ _openid: true, name: true, shopName: true }).get()
      shops.forEach(s => { cNameMap[s._openid] = s.name || s.shopName || '酒客' })
    }
    const comments = docs.map(c => ({
      _id:          c._id,
      content:      c.content,
      authorName:   cNameMap[c._openid] || '酒客',
      createdAtStr: _fmtTs(c.createdAt),
    }))
    return {
      success: true,
      data:    comments,
      hasMore,
      lastId:  docs.length ? docs[docs.length - 1]._id : null,
    }
  } catch (e) {
    console.error('[detailCommentList]', e)
    return { success: false, error: e.message }
  }
}

// ── detailTagVote：更新用户贴的标签（全量替换） ─────────────
async function actionDetailTagVote(openid, publicId, tags) {
  tags = (tags || []).slice(0, 5).map(t => String(t).trim().slice(0, 20)).filter(Boolean)
  if (!publicId) return { success: false, error: 'publicId_required' }
  try {
    const tvCol = db.collection('recipe_tagvotes')
    const { data: [old] } = await tvCol.where({ publicId, _openid: openid }).limit(1).get()
    const oldTags = old ? (old.tags || []) : []

    const added   = tags.filter(t => !oldTags.includes(t))
    const removed = oldTags.filter(t => !tags.includes(t))

    // 更新 recipe_tagvotes
    if (old) {
      await tvCol.doc(old._id).update({ data: { tags, updatedAt: Date.now() } })
    } else if (tags.length) {
      await tvCol.add({ data: { publicId, _openid: openid, tags, createdAt: Date.now() } })
    }

    // 原子更新 public_recipes.tagVotes
    if (added.length || removed.length) {
      const patch = {}
      added.forEach(t   => { patch[`tagVotes.${t}`] = _.inc(1)  })
      removed.forEach(t => { patch[`tagVotes.${t}`] = _.inc(-1) })
      await pCol.doc(publicId).update({ data: patch })
    }

    const { data: updated } = await pCol.doc(publicId).get()
    return { success: true, tagVotes: updated.tagVotes || {}, myTags: tags }
  } catch (e) {
    console.error('[detailTagVote]', e)
    return { success: false, error: e.message }
  }
}