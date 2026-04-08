// AI营销图配置文件
// 修改此文件后重新部署 imagegen 云函数即可生效，无需修改 index.js

module.exports = {

  // ── 模型配置 ──────────────────────────────────────────────
  DEFAULT_TEXT_MODEL:  'qwen3.5-flash',                 // 提示词生成：阿里云百炼（快且省 token）
  DEFAULT_IMAGE_MODEL: 'doubao-seedream-4-0-250828', // 图片生成：豆包 Seedream（ARK API）

  // ── 封面图（1:1）风格预设 ─────────────────────────────────
  STYLES: {
    elegant: {
      label: '精致暗调', emoji: '🥃', desc: '高级感暗调',
      pos:  'dark moody cocktail bar photography, dramatic chiaroscuro lighting, black marble surface, gold rim glass, bokeh, 8k commercial photography',
      neg:  'text, watermark, logo, cartoon, low quality, blurry',
      size: '1024x1024',
    },
    bright: {
      label: '清新明亮', emoji: '☀️', desc: 'Instagram 风',
      pos:  'bright airy cocktail photography, soft natural window light, pastel linen background, fresh herb garnish, Instagram food editorial',
      neg:  'dark, moody, neon, text, watermark, low quality',
      size: '1024x1024',
    },
    vintage: {
      label: '复古胶片', emoji: '📷', desc: '70年代风格',
      pos:  'vintage 1970s cocktail bar photograph, kodachrome film grain, warm amber tones, retro neon sign blur, analog photography',
      neg:  'modern, digital, text, watermark, low quality',
      size: '1024x1024',
    },
    minimal: {
      label: '极简白底', emoji: '⬜', desc: '菜单卡片风',
      pos:  'minimalist cocktail flat lay, pure white seamless background, top-down overhead shot, perfect composition, menu card aesthetic, studio lighting',
      neg:  'dark, colorful, busy, text, watermark, low quality',
      size: '1024x1024',
    },
    neon: {
      label: '霓虹夜店', emoji: '🌈', desc: '赛博朋克',
      pos:  'neon-lit cocktail scene, vivid purple and cyan neon glow, reflective wet bar surface, cyberpunk night bar atmosphere, cinematic synthwave',
      neg:  'daylight, bright white, text, watermark, low quality',
      size: '1024x1024',
    },
    watercolor: {
      label: '水彩插画', emoji: '🎨', desc: '艺术插画风',
      pos:  'beautiful watercolor illustration of cocktail, loose wet brush strokes, soft pastel washes, artistic menu illustration style',
      neg:  'photo realistic, 3d render, text, watermark, low quality',
      size: '1024x1024',
    },
  },

  // ── 海报（3:4）风格预设 ───────────────────────────────────
  POSTER_STYLES: {
    luxury: {
      label: '奢华金黑', emoji: '🖤', desc: '高端夜店风',
      pos:  'luxurious dark bar atmosphere, black marble table, gold accent lighting, premium spirits bottles blurred background, cinematic vertical composition, ultra high end, no text no people',
      neg:  'text, watermark, logo, face, people, blurry, low quality',
      size: '768x1024',
    },
    garden: {
      label: '花园清新', emoji: '🌿', desc: '夏日户外风',
      pos:  'lush tropical garden bar setting, dappled sunlight, botanical leaves, colorful fresh cocktails on wooden table, vertical poster composition, bright cheerful, no text no people',
      neg:  'dark, moody, text, watermark, face, people, low quality',
      size: '768x1024',
    },
    retro: {
      label: '复古海报', emoji: '🎞', desc: '70年代美式',
      pos:  'retro 1970s American bar poster background, warm amber and rust tones, neon sign glow, film grain texture, vintage poster aesthetic, vertical composition, no text no people',
      neg:  'modern, digital clean, text, watermark, face, people, low quality',
      size: '768x1024',
    },
    minimal: {
      label: '极简白', emoji: '⬜', desc: '简约菜单风',
      pos:  'clean minimalist white poster background, subtle texture, soft shadow, elegant empty space for text, vertical format, premium stationery feel, no text no people',
      neg:  'busy, colorful, text, watermark, face, people, low quality',
      size: '768x1024',
    },
    neon: {
      label: '霓虹赛博', emoji: '🌈', desc: '夜店赛博风',
      pos:  'neon cyberpunk bar background, vivid purple magenta cyan lights, wet reflective floor, moody vertical composition, night club atmosphere, no text no people',
      neg:  'daylight, bright white, text, watermark, face, people, low quality',
      size: '768x1024',
    },
  },

  // ── 提示词模板 ────────────────────────────────────────────
  buildRecipePrompt({ name, ingredients, desc, notes, customPrompt }) {
    const ings = (ingredients || []).slice(0, 5).map(i => i.name || '').filter(Boolean).join(', ')
    return `为以下鸡尾酒生成一段英文图片提示词（image generation prompt），不超过 50 词。

配方：
- 名称：${name}
- 原料：${ings || '酒类、果汁'}
- 特色：${desc || notes || '精致鸡尾酒'}
${customPrompt ? `- 额外要求：${customPrompt}` : ''}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 重点描述酒杯外观、颜色、装饰物、画面质感
3. 不包含任何文字/标志/水印相关描述`
  },

  buildCollectionPrompt({ name, cocktails, recipes, customPrompt }) {
    const names = (cocktails || recipes || []).slice(0, 4).map(c => c.name).filter(Boolean).join('、')
    return `为以下酒单合集生成一段英文图片提示词（image generation prompt），不超过 50 词。

合集：
- 名称：${name}
- 包含酒款：${names || '精选鸡尾酒'}
${customPrompt ? `- 额外要求：${customPrompt}` : ''}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 展现多杯精美鸡尾酒或酒吧场景，体现合集整体氛围
3. 不包含任何文字/标志/水印相关描述`
  },

  buildPosterPrompt({ name, recipes, desc, customPrompt }) {
    const names = (recipes || []).slice(0, 4).map(r => r.name).filter(Boolean).join('、')
    return `为以下小酒馆合集生成英文海报背景图提示词，不超过 60 词。

合集信息：
- 合集名：${name}
- 包含酒款：${names || '精选鸡尾酒'}
- 描述：${desc || '精选特调'}
${customPrompt ? `- 额外要求：${customPrompt}` : ''}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 描述酒吧氛围背景，体现合集整体风格
3. 竖版构图（3:4），预留顶部和底部给文字排版
4. 绝对不含文字、数字、标志、人脸`
  },
}
