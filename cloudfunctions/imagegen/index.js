// cloudfunctions/imagegen/index.js
// 图片生成云函数
//
// 流程：
//   1. buildPrompt — 调 Anthropic Claude Haiku 将配方/合集数据转为专业中英文图片提示词
//   2. genImage    — 用提示词调豆包 Seedream（OpenAI Images API 格式）生图，
//                    下载图片 → 上传微信云存储 → 返回 fileID + 临时链接
//
// 环境变量（云函数控制台配置）：
//   ANTHROPIC_API_KEY   必填  Claude API Key（生成提示词）
//   DOUBAO_API_KEY      必填  豆包/代理服务的 API Key
//   DOUBAO_API_URL      可选  默认 https://chatbot.cn.unreachablecity.club/v1/image/generations
//   DOUBAO_MODEL        可选  默认 doubao-seedream-4-0-250828
//   IMAGE_SIZE          可选  默认 1024x1024，可选 512x512 | 768x768 | 1024x1024

const cloud = require('wx-server-sdk')
const https  = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db   = cloud.database()
const imgs = db.collection('recipe_images')

// ── 风格预设 ───────────────────────────────────────────────
const STYLES = {
  elegant: {
    label: '精致暗调',
    emoji: '🥃',
    desc:  '高级感暗调',
    pos:   'dark moody cocktail bar photography, dramatic chiaroscuro lighting, black marble surface, gold rim glass, bokeh, 8k commercial photography',
    neg:   'text, watermark, logo, cartoon, low quality, blurry',
  },
  bright: {
    label: '清新明亮',
    emoji: '☀️',
    desc:  'Instagram 风',
    pos:   'bright airy cocktail photography, soft natural window light, pastel linen background, fresh herb garnish, Instagram food editorial',
    neg:   'dark, moody, neon, text, watermark, low quality',
  },
  vintage: {
    label: '复古胶片',
    emoji: '📷',
    desc:  '70年代风格',
    pos:   'vintage 1970s cocktail bar photograph, kodachrome film grain, warm amber tones, retro neon sign blur, analog photography',
    neg:   'modern, digital, text, watermark, low quality',
  },
  minimal: {
    label: '极简白底',
    emoji: '⬜',
    desc:  '菜单卡片风',
    pos:   'minimalist cocktail flat lay, pure white seamless background, top-down overhead shot, perfect composition, menu card aesthetic, studio lighting',
    neg:   'dark, colorful, busy, text, watermark, low quality',
  },
  neon: {
    label: '霓虹夜店',
    emoji: '🌈',
    desc:  '赛博朋克',
    pos:   'neon-lit cocktail scene, vivid purple and cyan neon glow, reflective wet bar surface, cyberpunk night bar atmosphere, cinematic synthwave',
    neg:   'daylight, bright white, text, watermark, low quality',
  },
  watercolor: {
    label: '水彩插画',
    emoji: '🎨',
    desc:  '艺术插画风',
    pos:   'beautiful watercolor illustration of cocktail, loose wet brush strokes, soft pastel washes, artistic menu illustration style',
    neg:   'photo realistic, 3d render, text, watermark, low quality',
  },
}

// ── 海报专属背景风格（3:4 竖版，无文字，供 Canvas 叠加排版）──
const POSTER_STYLES = {
  luxury: {
    label: '奢华金黑',
    emoji: '🖤',
    desc:  '高端夜店风',
    pos:   'luxurious dark bar atmosphere, black marble table, gold accent lighting, premium spirits bottles blurred background, cinematic vertical composition, ultra high end, no text no people',
    neg:   'text, watermark, logo, face, people, blurry, low quality',
    size:  '1024x1344',
  },
  garden: {
    label: '花园清新',
    emoji: '🌿',
    desc:  '夏日户外风',
    pos:   'lush tropical garden bar setting, dappled sunlight, botanical leaves, colorful fresh cocktails on wooden table, vertical poster composition, bright cheerful, no text no people',
    neg:   'dark, moody, text, watermark, face, people, low quality',
    size:  '1024x1344',
  },
  retro: {
    label: '复古海报',
    emoji: '🎞',
    desc:  '70年代美式',
    pos:   'retro 1970s American bar poster background, warm amber and rust tones, neon sign glow, film grain texture, vintage poster aesthetic, vertical composition, no text no people',
    neg:   'modern, digital clean, text, watermark, face, people, low quality',
    size:  '1024x1344',
  },
  minimal: {
    label: '极简白',
    emoji: '⬜',
    desc:  '简约菜单风',
    pos:   'clean minimalist white poster background, subtle texture, soft shadow, elegant empty space for text, vertical format, premium stationery feel, no text no people',
    neg:   'busy, colorful, text, watermark, face, people, low quality',
    size:  '1024x1344',
  },
  neon: {
    label: '霓虹赛博',
    emoji: '🌈',
    desc:  '夜店赛博风',
    pos:   'neon cyberpunk bar background, vivid purple magenta cyan lights, wet reflective floor, moody vertical composition, night club atmosphere, no text no people',
    neg:   'daylight, bright white, text, watermark, face, people, low quality',
    size:  '1024x1344',
  },
}

// ── 主入口 ─────────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  const { action  } = event

  switch (action) {
    case 'getStyles':       return actionGetStyles()
    case 'getPosterStyles': return actionGetPosterStyles()
    case 'buildPrompt':     return await actionBuildPrompt(event)
    case 'buildPosterPrompt': return await actionBuildPosterPrompt(event)
    case 'genImage':        return await actionGenImage(OPENID, event)
    case 'genPoster':       return await actionGenPoster(OPENID, event)
    // pollStatus 已不再需要（豆包同步返回），保留兼容旧轮询前端
    case 'pollStatus':  return { success: true, status: 'done_not_needed' }
    default:            return { success: false, error: 'unknown_action' }
  }
}

// ── getStyles ─────────────────────────────────────────────
function actionGetStyles() {
  return {
    success: true,
    styles: Object.entries(STYLES).map(([id, s]) => ({
      id, label: s.label, emoji: s.emoji, desc: s.desc,
    })),
  }
}

function actionGetPosterStyles() {
  return {
    success: true,
    styles: Object.entries(POSTER_STYLES).map(([id, s]) => ({
      id, label: s.label, emoji: s.emoji, desc: s.desc,
    })),
  }
}

// ── buildPrompt：Claude Haiku 生成专业提示词 ──────────────
async function actionBuildPrompt(event) {
  const { type, data, style = 'elegant', customPrompt = '' } = event
  const styleConf = STYLES[style] || STYLES.elegant
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''

  if (!ANTHROPIC_KEY) {
    // 无 Claude Key：规则降级
    return {
      success:   true,
      prompt:    buildFallbackPrompt(type, data, styleConf, customPrompt),
      negPrompt: styleConf.neg,
    }
  }

  const userMsg = buildClaudeInstruction(type, data, styleConf, customPrompt)

  try {
    const body = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: userMsg }],
    })
    const raw = await httpsPost('https://api.anthropic.com/v1/messages', {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    }, body)

    const res    = JSON.parse(raw)
    const text   = (res.content && res.content[0] && res.content[0].text || '').trim()
    if (!text) throw new Error('empty response from Claude')

    return {
      success:   true,
      prompt:    `${text}, ${styleConf.pos}`,
      negPrompt: styleConf.neg,
    }
  } catch (e) {
    console.error('[buildPrompt] Claude error:', e.message)
    return {
      success:   true,
      prompt:    buildFallbackPrompt(type, data, styleConf, customPrompt),
      negPrompt: styleConf.neg,
    }
  }
}

function buildClaudeInstruction(type, data, styleConf, customPrompt) {
  if (type === 'recipe') {
    const ings = (data.ingredients || [])
      .slice(0, 5)
      .map(i => i.name || (typeof i === 'string' ? i : ''))
      .filter(Boolean).join(', ')

    return `为以下鸡尾酒生成一段英文图片提示词（image generation prompt），不超过 50 词。

配方：
- 名称：${data.name}
- 原料：${ings || '酒类、果汁'}
- 特色：${data.desc || data.notes || '精致鸡尾酒'}
${customPrompt ? `- 额外要求：${customPrompt}` : ''}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 重点描述酒杯外观、颜色、装饰物、画面质感
3. 不包含任何文字/标志/水印相关描述`
  }

  const names = (data.cocktails || data.recipes || [])
    .slice(0, 4).map(c => c.name).filter(Boolean).join('、')

  return `为以下酒单合集生成一段英文图片提示词（image generation prompt），不超过 50 词。

合集：
- 名称：${data.name}
- 包含酒款：${names || '精选鸡尾酒'}
${customPrompt ? `- 额外要求：${customPrompt}` : ''}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 展现多杯精美鸡尾酒或酒吧场景，体现合集整体氛围
3. 不包含任何文字/标志/水印相关描述`
}

function buildFallbackPrompt(type, data, styleConf, customPrompt) {
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

// ── buildPosterPrompt：为合集生成海报背景图专用提示词 ──────
// type 固定为 'collection_poster'，风格由 posterStyle 指定
async function actionBuildPosterPrompt(event) {
  const { data, posterStyle = 'luxury', customPrompt = '' } = event
  const styleConf = POSTER_STYLES[posterStyle] || POSTER_STYLES.luxury
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''

  const fallback = buildPosterFallbackPrompt(data, styleConf, customPrompt)

  if (!ANTHROPIC_KEY) return { success: true, prompt: fallback, negPrompt: styleConf.neg, size: styleConf.size }

  const cocktailNames = (data.recipes || []).slice(0, 4).map(r => r.name).filter(Boolean).join('、')

  const userMsg = `为以下小酒馆合集生成一段英文图片提示词（image generation prompt），作为海报背景图，不超过 60 词。

合集信息：
- 合集名：${data.name}
- 包含酒款：${cocktailNames || '精选鸡尾酒'}
- 合集描述：${data.desc || '精选特调'}
${customPrompt ? `- 额外要求：${customPrompt}` : ''}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 描述酒吧氛围、意境、背景环境，体现合集整体风格
3. 竖版构图（3:4），预留顶部和底部给文字排版
4. 绝对不能包含任何文字、数字、标志、人脸`

  try {
    const body = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: userMsg }],
    })
    const raw = await httpsPost('https://api.anthropic.com/v1/messages', {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    }, body)
    const res  = JSON.parse(raw)
    const text = (res.content && res.content[0] && res.content[0].text || '').trim()
    if (!text) throw new Error('empty')
    return { success: true, prompt: `${text}, ${styleConf.pos}`, negPrompt: styleConf.neg, size: styleConf.size }
  } catch (e) {
    console.error('[buildPosterPrompt]', e.message)
    return { success: true, prompt: fallback, negPrompt: styleConf.neg, size: styleConf.size }
  }
}

function buildPosterFallbackPrompt(data, styleConf, customPrompt) {
  const names = (data.recipes || []).slice(0, 3).map(r => r.name).filter(Boolean).join(', ')
  let base = `A stunning cocktail bar background for ${data.name || 'cocktail collection'}`
  if (names) base += `, featuring ${names}`
  if (customPrompt) base += `, ${customPrompt}`
  return `${base}, vertical 3:4 composition with space for text overlay, ${styleConf.pos}`
}

// ── genImage：调豆包 Seedream 生图（OpenAI Images API 格式）
async function actionGenImage(openid, event) {
  const { prompt, negPrompt = '', style = 'elegant', nameHint = 'img' } = event
  if (!prompt) return { success: false, error: 'prompt_required' }

  const API_KEY  = process.env.DOUBAO_API_KEY || ''
  const API_URL  = (process.env.DOUBAO_API_URL  || 'https://chatbot.cn.unreachablecity.club/v1/image/generations').replace(/\/$/, '')
  const MODEL    = process.env.DOUBAO_MODEL     || 'doubao-seedream-4-0-250828'
  const SIZE     = process.env.IMAGE_SIZE       || '1024x1024'

  if (!API_KEY) return { success: false, error: 'DOUBAO_API_KEY not configured' }

  // ── 构造 OpenAI Images API 请求体 ──────────────────────
  // 豆包 Seedream 支持 negative_prompt 通过扩展字段传递
  const requestBody = {
    model:           MODEL,
    prompt,
    n:               1,
    size:            SIZE,
    response_format: 'url',       // 返回图片 URL（另一选项：'b64_json'）
    // 豆包扩展：负向提示词
    negative_prompt: negPrompt || undefined,
  }
  // 去掉 undefined 字段
  Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k])

  const bodyStr = JSON.stringify(requestBody)

  try {
    console.log('[genImage] Calling Doubao Seedream, model:', MODEL, 'size:', SIZE)

    const raw = await httpsPost(API_URL, {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
    }, bodyStr)

    const res = JSON.parse(raw)

    // ── 标准 OpenAI Images API 响应结构 ──────────────────
    // {
    //   created: 1234567890,
    //   data: [
    //     { url: "https://..." }          // response_format: 'url'
    //     { b64_json: "base64string..." } // response_format: 'b64_json'
    //   ]
    // }
    if (!res.data || !res.data[0]) {
      const errMsg = res.error ? (res.error.message || JSON.stringify(res.error)) : 'no data in response'
      console.error('[genImage] Bad response:', JSON.stringify(res).slice(0, 300))
      return { success: false, error: errMsg }
    }

    const item = res.data[0]

    // 上传到微信云存储
    const cloudPath = `recipe_images/${openid}/${nameHint}_${Date.now()}.jpg`
    let   fileID

    if (item.url) {
      // URL 模式：下载后上传
      const buffer = await downloadBuffer(item.url)
      const result = await cloud.uploadFile({ cloudPath, fileContent: buffer })
      fileID = result.fileID
    } else if (item.b64_json) {
      // Base64 模式：直接转 buffer 上传
      const buffer = Buffer.from(item.b64_json, 'base64')
      const result = await cloud.uploadFile({ cloudPath, fileContent: buffer })
      fileID = result.fileID
    } else {
      return { success: false, error: 'unrecognized response format: no url or b64_json' }
    }

    // 获取临时访问链接
    const tempUrl = await getTempUrl(fileID)

    // ── 写入 recipe_images 集合 ───────────────────────────
    // targetType / targetId 由前端传入，让云函数在同一次调用内完成入库
    // 如果 targetId 有值，同时把该 target 的旧 isCover=true 记录改为 false
    const { targetType = '', targetId = '' } = event
    if (targetId) {
      try {
        // 把同一 target 的旧封面记录全部标为非封面
        await imgs
          .where({ _openid: openid, targetId, isCover: true })
          .update({ data: { isCover: false } })
        // 写入本次生成记录
        await imgs.add({
          data: {
            _openid:    openid,
            targetType,
            targetId,
            fileID,
            style,
            prompt:     event.prompt || '',
            isCover:    true,
            createdAt:  Date.now(),
          },
        })
      } catch (e) {
        // 入库失败不影响图片返回，仅记录日志
        console.error('[genImage] recipe_images write error:', e.message)
      }
    }

    return { success: true, status: 'done', fileID, tempUrl }

  } catch (e) {
    console.error('[genImage] error:', e.message)
    return { success: false, error: e.message }
  }
}

// ── 获取临时链接 ───────────────────────────────────────────
async function getTempUrl(fileID) {
  try {
    const res = await cloud.getTempFileURL({ fileList: [fileID] })
    return (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) || ''
  } catch (_) {
    return ''
  }
}

// ── HTTP 工具 ──────────────────────────────────────────────
function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u       = new URL(url)
    const isHttps = u.protocol === 'https:'
    const lib     = isHttps ? https : require('http')
    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (isHttps ? 443 : 80),
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  { ...headers, 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 400)}`))
        }
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
    const u       = new URL(url)
    const isHttps = u.protocol === 'https:'
    const lib     = isHttps ? https : require('http')
    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (isHttps ? 443 : 80),
      path:     u.pathname + u.search,
      method:   'GET',
    }, res => {
      // 跟随重定向（最多 3 次）
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(Buffer.concat(chunks))
        } else {
          reject(new Error(`download HTTP ${res.statusCode}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('download timeout')) })
    req.end()
  })
}

// ── genPoster：生成合集海报背景图 ─────────────────────────
// 流程：接收 buildPosterPrompt 生成的 prompt → 调豆包（3:4 尺寸）
//       → 上传云存储（路径前缀 posters/）→ 写 recipe_images（imageType:'poster'）
// 前端拿到 tempUrl 后用 Canvas 叠加酒馆名/合集名/酒款列表文字
// event: { prompt, negPrompt, size, posterStyle, targetId, nameHint }
async function actionGenPoster(openid, event) {
  const {
    prompt, negPrompt = '', size = '1024x1344',
    posterStyle = 'luxury', targetId = '', nameHint = 'poster',
  } = event

  if (!prompt) return { success: false, error: 'prompt_required' }

  const API_KEY = process.env.DOUBAO_API_KEY || ''
  const API_URL = (process.env.DOUBAO_API_URL || 'https://chatbot.cn.unreachablecity.club/v1/image/generations').replace(/\/$/, '')
  const MODEL   = process.env.DOUBAO_MODEL   || 'doubao-seedream-4-0-250828'

  if (!API_KEY) return { success: false, error: 'DOUBAO_API_KEY not configured' }

  const requestBody = {
    model:           MODEL,
    prompt,
    n:               1,
    size,                           // 3:4 竖版
    response_format: 'url',
    negative_prompt: negPrompt || undefined,
  }
  Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k])

  try {
    console.log('[genPoster] size:', size, 'style:', posterStyle)
    const raw = await httpsPost(API_URL, {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
    }, JSON.stringify(requestBody))

    const res = JSON.parse(raw)
    if (!res.data || !res.data[0]) {
      const errMsg = res.error ? (res.error.message || JSON.stringify(res.error)) : 'no data'
      return { success: false, error: errMsg }
    }

    const item = res.data[0]

    // 上传到云存储（posters/ 目录，与 recipe_images/ 区分）
    const safeHint = nameHint.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 20)
    const cloudPath = `posters/${openid}/${safeHint}_${Date.now()}.jpg`
    let fileID

    if (item.url) {
      const buffer = await downloadBuffer(item.url)
      const result = await cloud.uploadFile({ cloudPath, fileContent: buffer })
      fileID = result.fileID
    } else if (item.b64_json) {
      const buffer = Buffer.from(item.b64_json, 'base64')
      const result = await cloud.uploadFile({ cloudPath, fileContent: buffer })
      fileID = result.fileID
    } else {
      return { success: false, error: 'unrecognized response format' }
    }

    const tempUrl = await getTempUrl(fileID)

    // 写入 recipe_images 集合（imageType:'poster' 区分封面图）
    if (targetId) {
      try {
        await db.collection('recipe_images').add({
          data: {
            _openid:    openid,
            targetType: 'collection',
            targetId,
            fileID,
            style:      posterStyle,
            imageType:  'poster',        // 区别于 cover 封面图
            prompt:     prompt.slice(0, 200),
            isCover:    false,           // 海报不设为封面
            createdAt:  Date.now(),
          }
        })
      } catch (e) {
        console.error('[genPoster] recipe_images write error:', e.message)
      }
    }

    return { success: true, status: 'done', fileID, tempUrl }
  } catch (e) {
    console.error('[genPoster] error:', e.message)
    return { success: false, error: e.message }
  }
}
