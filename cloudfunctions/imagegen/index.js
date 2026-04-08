// cloudfunctions/imagegen/index.js
// AI营销图云函数
//
// 环境变量：
//   BAILIAN_API_KEY     必填  阿里云百炼 API Key（提示词生成，qwen-turbo）
//   BAILIAN_API_URL     可选  默认 https://dashscope.aliyuncs.com/compatible-mode/v1
//   BAILIAN_TEXT_MODEL  可选  默认 qwen-turbo（提示词生成）
//   ARK_API_KEY         必填  豆包 ARK API Key（图片生成，doubao-seedream）
//   ARK_API_URL         可选  默认 https://ark.cn-beijing.volces.com/api/v3
//   DOUBAO_MODEL        可选  默认 doubao-seedream-4-0-250828

const cloud = require('wx-server-sdk')
const https  = require('https')
const CFG    = require('./config')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db   = cloud.database()
const imgs = db.collection('recipe_images')

// ── 主入口 ─────────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  switch (event.action) {
    case 'getStyles':         return actionGetStyles()
    case 'getPosterStyles':   return actionGetPosterStyles()
    case 'buildPrompt':       return await actionBuildPrompt(event)
    case 'buildPosterPrompt': return await actionBuildPosterPrompt(event)
    case 'genImage':          return await actionGenImage(OPENID, event)
    case 'genPoster':         return await actionGenPoster(OPENID, event)
    case 'pollStatus':        return { success: true, status: 'done_not_needed' }
    default:                  return { success: false, error: 'unknown_action' }
  }
}

// ── getStyles ─────────────────────────────────────────────
function actionGetStyles() {
  return {
    success: true,
    styles: Object.entries(CFG.STYLES).map(([id, s]) => ({
      id, label: s.label, emoji: s.emoji, desc: s.desc,
    })),
  }
}

function actionGetPosterStyles() {
  return {
    success: true,
    styles: Object.entries(CFG.POSTER_STYLES).map(([id, s]) => ({
      id, label: s.label, emoji: s.emoji, desc: s.desc,
    })),
  }
}

// ── buildPrompt：百炼 qwen-turbo 生成图片提示词 ────────────
async function actionBuildPrompt(event) {
  const { type, data, style = 'elegant', customPrompt = '' } = event
  const styleConf = CFG.STYLES[style] || CFG.STYLES.elegant

  const instruction = type === 'recipe'
    ? CFG.buildRecipePrompt({ ...data, customPrompt })
    : CFG.buildCollectionPrompt({ ...data, customPrompt })

  try {
    const text = await _callBailianText(instruction, { maxTokens: 200 })
    if (!text) throw new Error('empty response')
    return {
      success:   true,
      prompt:    `${text.trim()}, ${styleConf.pos}`,
      negPrompt: styleConf.neg,
    }
  } catch (e) {
    console.error('[buildPrompt] Bailian error:', e.message)
    return {
      success:   true,
      prompt:    _buildFallbackPrompt(type, data, styleConf, customPrompt),
      negPrompt: styleConf.neg,
    }
  }
}

// ── buildPosterPrompt：为合集生成海报背景提示词 ────────────
async function actionBuildPosterPrompt(event) {
  const { data, posterStyle = 'luxury', customPrompt = '' } = event
  const styleConf = CFG.POSTER_STYLES[posterStyle] || CFG.POSTER_STYLES.luxury
  const fallback  = _buildPosterFallback(data, styleConf, customPrompt)

  try {
    const instruction = CFG.buildPosterPrompt({ ...data, customPrompt })
    const text = await _callBailianText(instruction, { maxTokens: 200 })
    if (!text) throw new Error('empty')
    return {
      success:   true,
      prompt:    `${text.trim()}, ${styleConf.pos}`,
      negPrompt: styleConf.neg,
      size:      styleConf.size,
    }
  } catch (e) {
    console.error('[buildPosterPrompt]', e.message)
    return { success: true, prompt: fallback, negPrompt: styleConf.neg, size: styleConf.size }
  }
}

// ── genImage：豆包 Seedream 生成封面图（1:1）──────────────
async function actionGenImage(openid, event) {
  const { prompt, style = 'elegant', nameHint = 'img' } = event
  if (!prompt) return { success: false, error: 'prompt_required' }

  const styleConf = CFG.STYLES[style] || CFG.STYLES.elegant
  const size      = styleConf.size || '1024x1024'

  try {
    const item = await _callDoubaoImage({ prompt, size })

    const cloudPath = `recipe_images/${openid}/${nameHint}_${Date.now()}.jpg`
    const fileID    = await _uploadImageItem(item, cloudPath)
    const tempUrl   = await getTempUrl(fileID)

    // 写 recipe_images 集合
    const { targetType = '', targetId = '' } = event
    if (targetId) {
      try {
        await imgs.where({ _openid: openid, targetId, isCover: true }).update({ data: { isCover: false } })
        await imgs.add({
          data: {
            _openid: openid, targetType, targetId, fileID, style,
            prompt:  event.prompt || '', isCover: true, createdAt: Date.now(),
          },
        })
      } catch (e) { console.error('[genImage] DB write error:', e.message) }
    }

    return { success: true, status: 'done', fileID, tempUrl }
  } catch (e) {
    console.error('[genImage] error:', e.message)
    return { success: false, error: e.message }
  }
}

// ── genPoster：豆包 Seedream 生成海报背景图（3:4）─────────
async function actionGenPoster(openid, event) {
  const {
    prompt, posterStyle = 'luxury',
    targetId = '', nameHint = 'poster',
  } = event
  if (!prompt) return { success: false, error: 'prompt_required' }

  const styleConf = CFG.POSTER_STYLES[posterStyle] || CFG.POSTER_STYLES.luxury
  const size      = styleConf.size || '768x1024'

  try {
    const item = await _callDoubaoImage({ prompt, size })

    const safeHint  = nameHint.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 20)
    const cloudPath = `posters/${openid}/${safeHint}_${Date.now()}.jpg`
    const fileID    = await _uploadImageItem(item, cloudPath)
    const tempUrl   = await getTempUrl(fileID)

    if (targetId) {
      try {
        await db.collection('recipe_images').add({
          data: {
            _openid: openid, targetType: 'collection', targetId, fileID,
            style: posterStyle, imageType: 'poster',
            prompt: prompt.slice(0, 200), isCover: false, createdAt: Date.now(),
          }
        })
      } catch (e) { console.error('[genPoster] DB write error:', e.message) }
    }

    return { success: true, status: 'done', fileID, tempUrl }
  } catch (e) {
    console.error('[genPoster] error:', e.message)
    return { success: false, error: e.message }
  }
}

// ── _callBailianText：百炼 chat completions ────────────────
async function _callBailianText(prompt, options = {}) {
  const API_KEY  = process.env.BAILIAN_API_KEY || ''
  const BASE_URL = (process.env.BAILIAN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
  const MODEL    = process.env.BAILIAN_TEXT_MODEL || CFG.DEFAULT_TEXT_MODEL

  if (!API_KEY) throw new Error('BAILIAN_API_KEY not configured')

  const body = JSON.stringify({
    model:       MODEL,
    messages:    [{ role: 'user', content: prompt }],
    max_tokens:  options.maxTokens || 300,
    temperature: 0.7,
  })

  const raw = await httpsPost(`${BASE_URL}/chat/completions`, {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
  }, body)

  const res = JSON.parse(raw)
  return res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content || ''
}

// ── _callDoubaoImage：豆包 Seedream 图片生成 ──────────────
async function _callDoubaoImage({ prompt, size }) {
  const API_KEY  = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || ''
  const BASE_URL = (process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '')
  const MODEL    = process.env.DOUBAO_MODEL || CFG.DEFAULT_IMAGE_MODEL

  if (!API_KEY) throw new Error('ARK_API_KEY not configured')

  const reqBody = {
    model:                        MODEL,
    prompt,
    sequential_image_generation:  'disabled',
    response_format:              'url',
    size,
    stream:                       false,
    watermark:                    true,
  }

  const raw = await httpsPost(`${BASE_URL}/images/generations`, {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
  }, JSON.stringify(reqBody))

  const res = JSON.parse(raw)
  if (!res.data || !res.data[0]) {
    const errMsg = res.error ? (res.error.message || JSON.stringify(res.error)) : 'no data in response'
    throw new Error(errMsg)
  }
  return res.data[0]
}

// ── _uploadImageItem：上传图片到云存储 ─────────────────────
async function _uploadImageItem(item, cloudPath) {
  let buffer
  if (item.url) {
    buffer = await downloadBuffer(item.url)
  } else if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64')
  } else {
    throw new Error('unrecognized image response: no url or b64_json')
  }
  const result = await cloud.uploadFile({ cloudPath, fileContent: buffer })
  return result.fileID
}

// ── 降级规则提示词 ─────────────────────────────────────────
function _buildFallbackPrompt(type, data, styleConf, customPrompt) {
  const name = data.name || 'cocktail'
  const ings = type === 'recipe'
    ? (data.ingredients || []).slice(0, 3).map(i => i.name || '').filter(Boolean).join(', ')
    : ''
  let base = type === 'recipe'
    ? `A stunning ${name} cocktail in an elegant glass${ings ? `, made with ${ings}` : ''}`
    : `A beautiful collection of ${name} cocktails arranged artfully`
  if (customPrompt) base += `, ${customPrompt}`
  return `${base}, ${styleConf.pos}`
}

function _buildPosterFallback(data, styleConf, customPrompt) {
  const names = (data.recipes || []).slice(0, 3).map(r => r.name).filter(Boolean).join(', ')
  let base = `A stunning cocktail bar background for ${data.name || 'cocktail collection'}`
  if (names) base += `, featuring ${names}`
  if (customPrompt) base += `, ${customPrompt}`
  return `${base}, vertical 3:4 composition with space for text overlay, ${styleConf.pos}`
}

// ── HTTP 工具 ──────────────────────────────────────────────
async function getTempUrl(fileID) {
  try {
    const res = await cloud.getTempFileURL({ fileList: [fileID] })
    return (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) || ''
  } catch (_) { return '' }
}

function httpsPost(url, headers, body) {
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
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 400)}`))
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('request timeout (60s)')) })
    req.write(body)
    req.end()
  })
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const u   = new URL(url)
    const lib = u.protocol === 'https:' ? https : require('http')
    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'https:' ? 443 : 80),
      path:     u.pathname + u.search,
      method:   'GET',
    }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(Buffer.concat(chunks))
        else reject(new Error(`download HTTP ${res.statusCode}`))
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('download timeout')) })
    req.end()
  })
}
