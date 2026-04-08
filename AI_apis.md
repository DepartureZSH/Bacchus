# Bacchus — AI API 调用全览

> 整理日期：2026-03-29

---

## 目录

1. [AI 酒单生成（百炼工作流应用）](#1-ai-酒单生成百炼工作流应用)
2. [AI 配方生成（Dify Workflow）](#2-ai-配方生成dify-workflow)
3. [图片提示词生成（百炼 qwen-turbo）](#3-图片提示词生成百炼-qwen-turbo)
4. [AI 图片生成（豆包 Seedream ARK）](#4-ai-图片生成豆包-seedream-ark)
5. [AI 经营建议（百炼 qwen-plus）](#5-ai-经营建议百炼-qwen-plus)

---

## 汇总表

| # | 功能 | AI 服务商 | 云函数 | 触发页面 | 配额 |
|---|------|-----------|--------|---------|------|
| 1 | AI 酒单生成 | 百炼工作流应用 | `ai-menu` | `pages/ai-menu` | 免费 10次/月，Pro 不限 |
| 2 | AI 配方生成 | Dify Workflow | `recipes` | `pages/my-recipes` | 免费 5次/月，Pro 不限 |
| 3 | 图片提示词生成 | 百炼 qwen-turbo | `imagegen` | `pages/ai-menu`、`pages/my-recipes` | 无限（失败降级规则生成） |
| 4 | AI 图片生成 | 豆包 Seedream（ARK）| `imagegen` | `pages/ai-menu`、`pages/my-recipes` | 按量计费（服务商侧） |
| 5 | AI 经营建议 | 百炼 qwen-plus | `analytics` | `pages/ai-menu`、`pages/analytics` | Pro 专属，3次/天 |

---

## 1. AI 酒单生成（百炼工作流应用）

### 调用路径

```
pages/ai-menu/ai-menu.js
  → wx.cloud.callFunction('ai-menu', { action: 'generate', goal, flavor, customPrompt })
    → cloudfunctions/ai-menu/index.js → _callBailianWorkflow(bizParams)
      → POST https://dashscope.aliyuncs.com/api/v2/apps/agent/{APP_ID}/compatible-mode/v1/responses
```

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `BAILIAN_API_KEY` | 阿里云百炼 API Key | ✅ |
| `BAILIAN_APP_ID` | 工作流应用 ID（覆盖 config.js 默认值） | 可选 |

> `BAILIAN_APP_ID` 未配置时使用 `config.js` 中的 `WORKFLOW_APP_ID` 字段兜底。

### 请求体

```json
{
  "stream": false,
  "biz_params": {
    "goal":               "高利润 | 清库存 | 日常 | 主题 | 随机",
    "flavor":             "果味 | 经典 | 清爽 | 创新 | 花香 | 热带 | 随机",
    "shop_name":          "（从 shops 集合读取）",
    "all_ingredients":    "原料1, 原料2, ...",
    "low_stock_items":    "[{\"name\":\"...\",\"stock\":0,\"unit\":\"ml\"}]",
    "output_format":      "json",
    "custom_requirement": "（可选，用户自定义额外要求）"
  }
}
```

> `custom_requirement` 仅在用户填写了自定义 Prompt 时追加，且此时跳过缓存。

### biz_params 数据来源

| 字段 | 数据来源 |
|------|---------|
| `goal` / `flavor` | 用户在前端 `ai-menu` 页面选择（选项从 `getConfig` action 加载，定义在 `config.js`） |
| `shop_name` | 云函数读取 `shops` 集合（当前用户记录） |
| `all_ingredients` | 云函数读取 `ingredients` 集合，取 `name` 字段逗号拼接 |
| `low_stock_items` | `ingredients` 中 `status !== 'ok'` 的项目，序列化为 JSON 字符串 |
| `custom_requirement` | 用户在 `ai-menu` 页面自定义 Prompt 输入框 |

### 工作流（单次阻塞调用）

```
1. 前端调用 action='generate'（含 goal、flavor、customPrompt）
   ↓
2. 云函数检查配额，读 shops / ingredients 集合
   ↓
3. 无 customPrompt 时检查缓存（cacheKey = goal_flavor_YYYYMMDD，TTL 30分钟）
   ↓
4. 向百炼工作流应用 POST biz_params，stream: false，等待完整响应
   ↓
5. 解析响应：output_text → 解包 {"result":"[...]"} → JSON.parse → cocktails[]
   ↓
6. cocktails 为空时返回 { error: 'parse_failed' }，不写缓存不扣配额
   ↓
7. 写缓存（aiMenuCache）& 扣配额（aiQuotaUsed +1）
   ↓
8. 返回 { cocktails, quotaUsed, quotaRemaining }
```

### 响应解析

百炼工作流将所有输出变量打包为 JSON 对象字符串，需两次解析：

```
HTTP raw
  → JSON.parse(raw)
  → res.output_text = '{"result":"[{...}]"}'   // 工作流输出变量包装
  → JSON.parse(output_text).result = '[{...}]'  // 取 result 字段
  → JSON.parse(result)                           // 最终数组
```

最终 `cocktails[]` 元素结构：

```json
{
  "emoji":          "🍹",
  "name":           "配方名",
  "matchScore":     85,
  "matchLevel":     "ok | warn | danger",
  "costEstimate":   12.5,
  "suggestedPrice": 45,
  "grossMargin":    72.2,
  "substitute":     "可选替代原料说明",
  "ingredients":    [{ "name": "金酒", "amount": 45, "unit": "ml", "isMissing": false }],
  "steps":          ["步骤1", "步骤2"],
  "notes":          "调酒师备注",
  "expanded":       true
}
```

### 配额与缓存逻辑

- 字段位置：`shops.aiQuotaUsed`、`shops.aiQuotaReset`
- 免费用户每月 10 次，Pro 不限次
- 超额返回 `{ error: 'quota_exceeded' }`
- 生成成功写缓存；生成失败（含 API 错误）清除该 shop 的 `aiMenuCache`
- `cocktails: []` 时不写缓存、不扣配额，返回 `{ error: 'parse_failed' }`

---

## 2. AI 配方生成（Dify Workflow）

### 调用路径

```
pages/my-recipes/my-recipes.js
  → wx.cloud.callFunction('recipes', { action: 'aiGenerate', flavors, base, note })
    → cloudfunctions/recipes/index.js → actionAiGenerate()
      → POST {DIFY_API_URL}/workflows/run   (blocking)
```

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DIFY_API_KEY` | Dify Workflow 的 API Key | ✅ |
| `DIFY_API_URL` | 同上 | 可选 |

### 请求体

```json
{
  "inputs": {
    "flavors": "果味、经典、清爽",
    "base":    "金酒 | 伏特加 | 随机 | ...",
    "note":    "用户自定义要求（可为空）"
  },
  "response_mode": "blocking",
  "user": "bacchus-cloud"
}
```

### Prompt 数据来源

| 字段 | 数据来源 |
|------|---------|
| `flavors` | 用户在 `my-recipes` 页面选择的口味标签（多选） |
| `base` | 用户选择的基酒 |
| `note` | 用户手动输入的备注要求 |

### 响应解析

`data.outputs.result` 为 JSON 字符串，经 `parseRecipeOutput()` 解析：

```json
{
  "emoji": "🥃",
  "name": "配方名",
  "base": "基酒",
  "style": "风格",
  "abv": 12,
  "desc": "描述",
  "ingredients": [{ "name": "原料", "amount": "30ml" }],
  "steps": ["步骤1", "步骤2"],
  "notes": "备注",
  "isAI": true
}
```

生成后直接写入 `recipes` 集合，并通过 `RDB.invalidateCache()` 刷新本地缓存。

### 配额逻辑

- 字段位置：`shops.recipeAiQuotaUsed`、`shops.recipeAiQuotaReset`
- 免费用户每月 5 次，Pro 不限次

---

## 3. 图片提示词生成（百炼 qwen-turbo）

### 调用路径

```
pages/my-recipes/my-recipes.js  （或 pages/ai-menu/ai-menu.js）
  → wx.cloud.callFunction('imagegen', { action: 'buildPrompt' | 'buildPosterPrompt', ... })
    → cloudfunctions/imagegen/index.js → actionBuildPrompt() / actionBuildPosterPrompt()
      → _callBailianText(instruction, { maxTokens: 200 })
        → POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `BAILIAN_API_KEY` | 阿里云百炼 API Key | 可选（无则降级规则生成） |
| `BAILIAN_API_URL` | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` | 可选 |
| `BAILIAN_TEXT_MODEL` | 默认 `qwen-turbo` | 可选 |

### 请求体

```json
{
  "model":       "qwen-turbo",
  "messages":    [{ "role": "user", "content": "（见下方 Prompt 模板）" }],
  "max_tokens":  200,
  "temperature": 0.7
}
```

### Prompt 模板（定义在 `cloudfunctions/imagegen/config.js`）

**配方封面图（1:1 方图，`buildRecipePrompt`）：**

```
为以下鸡尾酒生成一段英文图片提示词（image generation prompt），不超过 50 词。

配方：
- 名称：{recipe.name}
- 原料：{ingredients（取前5种）}
- 特色：{recipe.desc 或 recipe.notes}
{如有自定义要求：- 额外要求：{customPrompt}}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 重点描述酒杯外观、颜色、装饰物、画面质感
3. 不包含任何文字/标志/水印相关描述
```

**合集封面图（1:1 方图，`buildCollectionPrompt`）：**

```
为以下酒单合集生成一段英文图片提示词（image generation prompt），不超过 50 词。

合集：
- 名称：{collection.name}
- 包含酒款：{前4款配方名，逗号分隔}
{如有自定义要求：- 额外要求：{customPrompt}}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 展现多杯精美鸡尾酒或酒吧场景，体现合集整体氛围
3. 不包含任何文字/标志/水印相关描述
```

**海报背景图（3:4 竖版，`buildPosterPrompt`）：**

```
为以下小酒馆合集生成英文海报背景图提示词，不超过 60 词。

合集信息：
- 合集名：{collection.name}
- 包含酒款：{前4款配方名}
- 描述：{collection.desc}
{如有自定义要求：- 额外要求：{customPrompt}}

要求：
1. 只输出英文提示词，不加任何说明或引号
2. 描述酒吧氛围背景，体现合集整体风格
3. 竖版构图（3:4），预留顶部和底部给文字排版
4. 绝对不含文字、数字、标志、人脸
```

### Prompt 数据来源

| 字段 | 数据来源 |
|------|---------|
| `recipe.name`、`desc`、`notes` | 前端传入（`event.data`） |
| `ingredients` | `event.data.ingredients[]` 取前 5 种 `name` 字段 |
| `collection.name`、配方名列表 | 前端传入（`event.data`） |
| `customPrompt` | 用户在营销图页面输入的自定义词 |

### 响应解析

```json
{ "choices": [{ "message": { "content": "a beautiful cocktail glass..." } }] }
```

取 `choices[0].message.content`，拼接风格预设的正向关键词后传给豆包。

### 降级逻辑

`BAILIAN_API_KEY` 未配置或调用失败时，`_buildFallbackPrompt()` / `_buildPosterFallback()` 基于配方名称、原料和风格规则拼接英文提示词，确保图片生成不中断。

---

## 4. AI 图片生成（豆包 Seedream ARK）

### 调用路径

```
pages/my-recipes/my-recipes.js  （或 pages/ai-menu/ai-menu.js）
  → wx.cloud.callFunction('imagegen', { action: 'genImage' | 'genPoster', ... })
    → cloudfunctions/imagegen/index.js → actionGenImage() / actionGenPoster()
      → _callDoubaoImage({ prompt, size })
        → POST https://ark.cn-beijing.volces.com/api/v3/images/generations
      → 下载图片 Buffer → wx.cloud.uploadFile → 写入 recipe_images 集合
```

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `ARK_API_KEY` | 豆包 ARK API Key | ✅ |
| `ARK_API_URL` | 默认 `https://ark.cn-beijing.volces.com/api/v3` | 可选 |
| `DOUBAO_MODEL` | 默认 `doubao-seedream-4-0-250828` | 可选 |

> `ARK_API_KEY` 未设置时回退读取 `DOUBAO_API_KEY`（兼容旧配置）。

### 请求体

```json
{
  "model":                       "doubao-seedream-4-0-250828",
  "prompt":                      "（百炼 qwen-turbo 或规则生成的英文提示词 + 风格关键词）",
  "sequential_image_generation": "disabled",
  "response_format":             "url",
  "size":                        "1024x1024（封面）| 768x1024（海报3:4）",
  "stream":                      false,
  "watermark":                   true
}
```

> 不传 `negative_prompt`（ARK API 不支持）。

### 风格预设（定义在 `cloudfunctions/imagegen/config.js`）

**封面图 STYLES（1:1，size: `1024x1024`）：**

| id | label | 说明 |
|----|-------|------|
| `elegant` | 精致暗调 | 高级感暗调，金色玻璃 |
| `bright` | 清新明亮 | Instagram 风，柔光白底 |
| `vintage` | 复古胶片 | 70年代 Kodachrome 风 |
| `minimal` | 极简白底 | 菜单卡片，俯拍 |
| `neon` | 霓虹夜店 | 赛博朋克，紫青霓虹 |
| `watercolor` | 水彩插画 | 艺术插画风 |

**海报 POSTER_STYLES（3:4，size: `768x1024`）：**

| id | label | 说明 |
|----|-------|------|
| `luxury` | 奢华金黑 | 高端夜店，大理石台面 |
| `garden` | 花园清新 | 夏日户外，植物光影 |
| `retro` | 复古海报 | 70年代美式，琥珀调 |
| `minimal` | 极简白 | 简约菜单风 |
| `neon` | 霓虹赛博 | 夜店赛博风 |

### 工作流

```
1. 前端传入 targetType, targetId, style/posterStyle, prompt（已由提示词生成步骤得到）
   ↓
2. 从 config.js 取风格对应的 size
   ↓
3. 调用豆包 ARK API 生成图片，得到图片 URL
   ↓
4. 云函数下载图片 Buffer（downloadBuffer，支持重定向）
   ↓
5. wx.cloud.uploadFile 上传到云存储
     封面：recipe_images/{openid}/{nameHint}_{timestamp}.jpg
     海报：posters/{openid}/{nameHint}_{timestamp}.jpg
   ↓
6. cloud.getTempFileURL 获取临时访问链接
   ↓
7. 写入 recipe_images 集合，返回 { fileID, tempUrl }
   ↓
8. 前端 RDB.updateCoverTempUrl(targetId, fileID, tempUrl) 更新内存+Storage 缓存
```

### 图片类型区分

| action | 尺寸 | `imageType` | `isCover` | 存储路径前缀 |
|--------|------|------------|-----------|------------|
| `genImage` | 1024×1024 | —（未设置） | `true` | `recipe_images/` |
| `genPoster` | 768×1024 | `'poster'` | `false` | `posters/` |

### 写入 `recipe_images` 集合的字段

```json
{
  "_openid":    "当前用户 openid",
  "targetType": "recipe | collection",
  "targetId":   "配方或合集 _id",
  "fileID":     "cloud://bacchus-prod-1.xxx/...",
  "style":      "elegant | vivid | minimal | ...",
  "prompt":     "生成用的提示词（海报截取前200字）",
  "isCover":    true,
  "imageType":  "poster（仅海报）",
  "createdAt":  "ServerDate"
}
```

### 封面 tempUrl 缓存机制

- `tempUrl` 有效期约 2 小时，本地 `wx.storage` 缓存 TTL = 50 分钟
- 每次进页面调 `RDB.preload()` → `imageCoverMap` → `getTempFileURL` 刷新

---

## 5. AI 经营建议（百炼 qwen-plus）

### 调用路径

```
pages/ai-menu/ai-menu.js（经营分析 Tab）
pages/analytics/analytics.js
  → wx.cloud.callFunction('analytics', { action: 'aiAdvice', period, forceRefresh })
    → cloudfunctions/analytics/index.js → actionAIAdvice()
      → _callBailianAdvice(prompt)
        → POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
      → 降级：_generateRuleAdvice()   (无需外部 API)
```

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `BAILIAN_API_KEY` | 阿里云百炼 API Key | 可选（无则规则降级） |
| `BAILIAN_API_URL` | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` | 可选 |
| `BAILIAN_TEXT_MODEL` | 默认 `qwen-plus` | 可选 |

> `BAILIAN_API_KEY` 未配置时自动使用规则引擎生成建议，功能不中断。

### 请求体

```json
{
  "model":       "qwen-plus",
  "messages":    [{ "role": "user", "content": "（见下方 Prompt 模板）" }],
  "max_tokens":  600,
  "temperature": 0.5
}
```

### Prompt 模板（定义在 `cloudfunctions/analytics/config.js`）

```
你是一名小酒馆经营顾问，根据以下数据给出3条简短实用的中文经营建议。
每条格式：{"icon":"emoji","title":"标题（10字内）","text":"正文（60字内）"}
只返回JSON数组，不要其他内容。

店名：{shopName}
周期：本{periodLabel}（week=周，month=月）
营收：¥{kpi.revenue}  利润：¥{kpi.profit}  毛利率：{kpi.margin}%
杯数：{kpi.cups}  趋势：{kpi.trend}
高频原料：{topIngredients（取前3，名称+成本）}
库存状态：正常{stockDist.ok}种 偏低{stockDist.warn}种 告急{stockDist.danger}种
```

### Prompt 数据来源

| 字段 | 数据来源 |
|------|---------|
| `shopName` | `shops` 集合 `name` 字段 |
| `kpi.*` | `analytics/actionSummary` 聚合 `sales_records` 集合 |
| `topIngredients` | `actionSummary` 统计 `stock_logs` 中出库成本，取前 3 |
| `stockDist` | `ingredients` 集合各库存状态数量统计 |

### 响应解析

`choices[0].message.content` 经 `_parseAdvice()` 去除 markdown 代码块后 parse：

```json
[
  { "icon": "📈", "title": "营业额持续增长", "text": "本周营收增长12%，建议趁势强化口碑营销..." },
  { "icon": "💰", "title": "关注毛利率",      "text": "毛利率 64%，可继续优化高成本原料采购..." },
  { "icon": "⚠️", "title": "库存预警",        "text": "1种原料告急，请尽快安排补货..." }
]
```

### 规则降级引擎（`_generateRuleAdvice`）

百炼不可用时，按以下优先级生成最多 3 条建议：

| 优先级 | 条件 | 建议内容 |
|--------|------|---------|
| 1 | 无销售数据（isEmpty） | 引导录入数据、完善库存、使用 AI 酒单 |
| 2 | 营业额趋势 | 下滑/增长/平稳对应不同措施 |
| 3 | 毛利率 < 40% | 控本建议 |
| 3 | 毛利率 40-55% | 提升空间提示 |
| 3 | 毛利率 ≥ 55% | 正向肯定 + 投入建议 |
| 4 | 库存告急（danger > 0） | 立即补货 |
| 4 | 库存偏低（warn > 0） | 近期补货 |
| 5 | 客单价 < ¥35 | 提升客单价 |
| 6 | 高成本原料 | 关注成本最高原料 |

### 权限与配额

- 仅 Pro 用户可用（`(shop.plan || '').toLowerCase() === 'pro'`）
- 每日最多 3 次（计数存于 `shops.aiAdviceCache.count_{YYYYMMDD}`）
- 30 分钟内同 period 命中缓存直接返回（`shops.aiAdviceCache.{period}_{date}`）
- 超限返回 `{ error: 'daily_limit', limit: 3, used: N }`
