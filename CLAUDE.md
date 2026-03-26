# Bacchus 鸡尾酒AI仓管 — 项目上下文

## 项目概述

微信小程序，面向小酒馆经营者，功能：库存管理、AI酒单生成（Dify）、配方/合集管理、AI营销图生成（豆包 Seedream）、发现页（用户公开分享）。

**云开发环境**：`bacchus-prod-1`（微信云开发 CloudBase/TCB）

---

## 目录结构（关键部分）

```
miniprogram/
├── app.js / app.json / app.wxss
├── data/
│   └── myRecipes.js          # 云端 recipes 适配器，含 coverUrl 本地缓存
├── pages/
│   ├── ai-menu/              # AI酒单 + AI营销（双Tab）
│   ├── my-recipes/           # 配方/合集/发现/收藏四Tab
│   ├── ingredients/          # 库存管理
│   ├── analytics/            # 经营分析
│   └── subscription/         # 订阅/Pro计划
└── cloudfunctions/
    ├── ai-menu/              # Dify Chatflow，submit+poll异步
    ├── recipes/              # 配方CRUD + 合集 + 发现页发布 + recipe_images管理
    └── imagegen/             # 豆包Seedream图片生成 + Claude Haiku生成提示词
```

---

## 数据库集合

| 集合 | 说明 | 权限 |
|------|------|------|
| `shops` | 用户店铺信息、配额、订阅状态 | 仅创建者 |
| `ingredients` | 库存原料 | 仅创建者 |
| `stock_logs` | 出入库记录 | 仅创建者 |
| `recipes` | 用户自创配方 | 仅创建者 |
| `collections` | 合集（含 recipeIds[]、tags[]、isPublic、publishId） | 仅创建者 |
| `recipe_images` | AI生成图片记录（fileID、targetId、targetType、isCover、imageType） | 仅创建者 |
| `public_recipes` | 用户公开发布的配方/合集 | **所有用户可读**，仅创建者写 |
| `analytics_snapshots` | 经营数据快照 | 仅创建者 |

---

## 云函数：`recipes` — Actions 一览

```
list / get / add / update / remove
toggleFav / getFavIds
collList / collAdd / collUpdate / collRemove / collToggle
collPublish / collUnpublish / collClone
aiGenerate / aiQuota
imageList / imageSetCover / imageDelete / imageCoverMap
discoverList / discoverPublish / discoverUnpublish / discoverLike / discoverGetLiked
```

**关键字段设计**：
- `recipes.isPublic + publishId` — 发布到发现页后回写
- `collections.tags[]` — 最多5个，供发现页筛选
- `public_recipes.authorOpenid` — 存 openid，查询时实时从 shops 读 name（不冗余存 authorName）
- `recipe_images.imageType` — `'poster'` 区别于普通封面图

---

## 云函数：`imagegen` — Actions 一览

```
getStyles / getPosterStyles
buildPrompt           # Claude Haiku → 英文图片提示词（配方/合集，1:1方图）
buildPosterPrompt     # Claude Haiku → 英文海报背景提示词（3:4竖版）
genImage              # 豆包Seedream → 1:1图，写入 recipe_images
genPoster             # 豆包Seedream → 1:1344/1024竖版，写入 recipe_images(imageType:'poster')
```

**环境变量**：
- `ANTHROPIC_API_KEY` — Claude Haiku（生成提示词，可选，无则降级规则生成）
- `DOUBAO_API_KEY` — 豆包/代理 Key（必填）
- `DOUBAO_API_URL` — 默认 `https://chatbot.cn.unreachablecity.club/v1/image/generations`
- `DOUBAO_MODEL` — 默认 `doubao-seedream-4-0-250828`

---

## 封面图机制（重要）

```
生成 → imagegen 云函数写 recipe_images（targetId、fileID、isCover）
     → 返回 fileID + tempUrl
     → 前端 RDB.updateCoverTempUrl(targetId, fileID, tempUrl) 写 wx.storage

进页面 → RDB.preload() → imageCoverMap → _cache.coverMap = { targetId: fileID }
       → getMyAll/getCollAll → _injectCover → coverFileID 注入
       → _fetchMissingTempUrls → getTempFileURL → setData coverTempUrl

tempUrl 有效期 2小时，存 wx.storage TTL=50分钟
进页面每次都重新调 getTempFileURL（不用 storage 缓存直接渲染，避免403）
```

---

## `data/myRecipes.js` — RDB 适配器关键 API

```js
RDB.preload()                          // 拉云端数据，同时调 imageCoverMap
RDB.getMyAll() / RDB.getCollAll()      // 同步读内存缓存，已注入 coverFileID
RDB.getCachedTempUrl(fileID)           // 读 wx.storage 缓存
RDB.saveTempUrl(fileID, url)           // 写 wx.storage 缓存
RDB.updateCoverTempUrl(targetId, fileID, tempUrl)  // 更新内存+storage
RDB.invalidateCache()                  // 重置 fetchedAt=0，下次 preload 强制重拉
```

---

## `pages/my-recipes` — 四个 Tab

| Tab | 内容 |
|-----|------|
| 发现 | 云端 `public_recipes`，标签筛选+类型切换（配方/合集/全部），点赞，复制 |
| 我的 | 自创配方，CRUD，发布到发现，AI生成封面/图片 |
| 收藏 | 收藏的配方 |
| 合集 | 合集管理，AI生成封面/海报/酒单图，发布到发现 |

---

## `pages/ai-menu` — 双 Tab

| Tab | 内容 |
|-----|------|
| AI酒单 | Dify submit+poll，生成3款推荐，存入配方/合集 |
| AI营销 | 单品图（1:1）/ 合集封面（1:1）/ 合集海报（3:4）/ 合集酒单图（3:4+Canvas文字）|

营销图生成后：
1. 直接 `mktgState:'done'` 显示 bgTempUrl（不走 canvas 中间态）
2. Canvas 排版异步执行（setTimeout 100ms），完成后更新 `localPath`
3. 历史图列表实时追加（`_refreshHistoryAfterGen`）
4. 每张历史图可独立编辑（`editingHistoryIdx`）、设封面、保存、删除

---

## 已知约束

- 微信云数据库 `doc(id).get()` 返回 `{ data: {...} }`（**不是数组**），`where().get()` 才返回 `{ data: [...] }`
- `wx.cloud.getTempFileURL` 只能前端调用，云函数内用 `cloud.getTempFileURL`
- 微信 Canvas 2d API：`canvas.toDataURL` 回调，不是 Promise
- `wx.showShareImageMenu` 需要小程序版本 >= 2.14.3
- 云函数超时默认60s，imagegen 生图可能接近超时，已设 `req.setTimeout(60000)`
