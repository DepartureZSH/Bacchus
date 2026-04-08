完整 TODO List（按优先级）

### P0 · Demo 必须可演示（本周内）

- √ 数据持久化：用 wx.storage 替换内存数组，入库/出库后刷新不丢失
- AI 酒单接真实接口（或稳定的规则引擎兜底，确保 Demo 时不出 bug）
- √ TabBar 图标：补充 4 组 PNG 图标（正常态 + 选中态）
- √ 新增原料页面（手动录入表单）
- √ 编辑原料功能（在详情页入口，可修改品牌/阈值/成本价）
- √ 采购清单页面（含复制文本功能，演示闭环必须）



### P1 · Demo 加分项（1-2周）

- √ 扫码录入功能（调用 wx.scanCode，识别条形码匹配原料模板）
- √ 经营分析页面（假数据+图表，用 echarts-for-weixin 或 wx-charts）
- √ 进入小程序时低库存主动提醒（wx.showModal 弹出）
- √ 按酒单一键扣减库存（AI酒单页 → 确认出单 → 自动扣减对应原料）改为（库存管理页 → 扫码/手动出库 → 自动扣减对应原料）

### P2 · 产品完整度（2-4周）

- √ 店铺信息页面（可编辑店名、地址）
- √ 订阅管理页面（Free/Pro 展示，含"首月5折"引导）
- √ 单位设置页面（ml/oz 切换，货币符号）
- √ 数据导出功能（生成 CSV 文本，调用 wx.setClipboardData 或分享）
- √ 帮助与反馈页面（FAQ + 微信客服入口）
- √ 内置配方库浏览页（30个经典鸡尾酒，供参考）

### P3 · 后端 & 多端（长期）

- 后端接口搭建（Supabase 或 Firebase）
  - √ Phase 1：登录 + 原料 CRUD + 出入库 + 数据迁移 → 核心功能上线
  - √ Phase 2：AI 酒单 + 配额 + 店铺/单位设置
  - √ Phase 3：经营分析 + 用户配方/合集
  - √ Phase 4：订阅/支付 + AI 经营建议 + 离线降级
- 账号体系：手机号登录 / 微信 UnionID 绑定
- 多端数据同步（小程序、Flutter App 同一账号）
- 多店管理（shop_id 隔离）
- 微信支付接入（Pro 版订阅）

给ai-menu页面添加1.把生成的配方一键添加到我的配方;2.一键添加到我的合集的功能;并且在my-recipes页面为配方/合集添加AI生成不同风格和提示词的配方图/酒单图的功能。先指定计划,给我计划后,再听我指令一步一步实现

claude --resume 41f5b270-24b7-4d02-b298-699db8bbe15c

git config --global user.name  "Stars Lord"
git config --global user.email "oncwnuIufNPSK_F9VBZKD1u4wlzE@git.weixin.qq.com"
git clone https://git.weixin.qq.com/15828030238/Bacchus_Bar_Demo.git

新需求：
TODO 将所有图标都统一存储为svg保存到assets\icons
TODO 将所有标签（包括AI生成的风格词、配方/合集标签、搜索标签）都写入数据库管理

将项目中所有AI api调用都整理出来写入AI_apis.md文档，要求包括此AI API调用在项目页面路径、云函数路径、prompt如何形成（工作流）等相关重要信息

TODO:
<!-- AI APIs都替换为阿里云百炼API
1. 对 AI 酒单生成 进行改造：涉及页面pages/ai-menu，云函数ai-menu。所有酒单目标和风格偏好存数据库或统一到配置文件，添加一些prompt额外要求由用户自定义输入的功能。
对 AI 酒单生成 进行改造：涉及页面pages/ai-menu，云函数ai-menu。直接调用阿里云百炼工作流应用API（此工作流已包含提示词优化等流程），HTTP请求示例如下：
curl -X POST 'https://dashscope.aliyuncs.com/api/v2/apps/agent/8bb65074cb644529945aeb238d05a92e/compatible-mode/v1/responses' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "stream": true
    "biz_params":
    {
      "goal":            "高利润",
      "flavor":          "果味",
      "shop_name":       "（从 shops 集合读取）",
      "all_ingredients": "原料1, 原料2, ...",
      "low_stock_items": "[]",
      "output_format":   "json"
    },
}'

修改bug，ai-menu AI生成酒单
已知查看阿里云百炼后台，得知最终返回：
{
  "result": "[{\"emoji\":\"🍋\",\"name\":\"柠汽探戈\",\"matchScore\":75,\"costEstimate\":12,\"suggestedPrice\":88,\"grossMargin\":86,\"substitute\":\"若400ml怡泉+C柠檬味汽水库存告急，可用等量苏打水+新鲜柠檬汁（约20ml）及少许糖浆替代风味。\",\"ingredients\":[{\"name\":\"400ml怡泉+C柠檬味汽水\",\"amount\":60,\"unit\":\"ml\"}],\"steps\":[\"冰镇柯林杯\",\"倒入60ml柠檬汽水\",\"加入两块方冰\",\"用柠檬皮喷香装饰\"],\"notes\":\"极简主义，突出汽泡感。\"},{\"emoji\":\"🌌\",\"name\":\"夜航星\",\"matchScore\":70,\"costEstimate\":18,\"suggestedPrice\":98,\"grossMargin\":82,\"substitute\":\"基酒伏特加可用金酒替代，风味更植物。\",\"ingredients\":[{\"name\":\"400ml怡泉+C柠檬味汽水\",\"amount\":45,\"unit\":\"ml\"}],\"steps\":[\"摇壶加冰\",\"倒入45ml伏特加\",\"shake后滤入杯\",\"补满柠檬汽水\"],\"notes\":\"建议使用蓝色糖浆挂壁。\"},{\"emoji\":\"🧊\",\"name\":\"冰柠絮语\",\"matchScore\":65,\"costEstimate\":15,\"suggestedPrice\":108,\"grossMargin\":86,\"substitute\":\"柠檬汽水紧张时，减半用量，用苏打水补足并加5ml柠檬糖浆。\",\"ingredients\":[{\"name\":\"400ml怡泉+C柠檬味汽水\",\"amount\":50,\"unit\":\"ml\"}],\"steps\":[\"杯底捣碎薄荷叶\",\"加碎冰至八分满\",\"缓慢倒入柠檬汽水\",\"插入吸管与薄荷枝\"],\"notes\":\"饮用前轻轻提拉薄荷。\"}]"
}
但微信云开发后台日志
返回结果
{"success":true,"fromCache":false,"cocktails":[],"quotaUsed":8,"quotaRemaining":null}
日志
START RequestId: 6a887d41-2ce6-4799-8acc-fa49e0392d76
Event RequestId: 6a887d41-2ce6-4799-8acc-fa49e0392d76
Response RequestId: 6a887d41-2ce6-4799-8acc-fa49e0392d76 RetMsg: {"success":true,"fromCache":false,"cocktails":[],"quotaUsed":8,"quotaRemaining":null}
END RequestId: 6a887d41-2ce6-4799-8acc-fa49e0392d76
Report RequestId: 6a887d41-2ce6-4799-8acc-fa49e0392d76 Duration: 23761ms Memory: 256MB MemUsage: 24.699219MB

2. 对 AI营销 进行改造：涉及页面pages/ai-menu，云函数imagegen。所有Prompt模板、图片风格预设等存数据库或统一到配置文件。
对 AI营销 进行改造：仍改用doubao-seedream-4-0-250828，调用示例如下：
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "doubao-seedream-4-0-250828",
    "prompt": "星际穿越，黑洞，黑洞里冲出一辆快支离破碎的复古列车，抢视觉冲击力，电影大片，末日既视感，动感，对比色，oc渲染，光线追踪，动态模糊，景深，超现实主义，深蓝，画面通过细腻的丰富的色彩层次塑造主体与场景，质感真实，暗黑风背景的光影效果营造出氛围，整体兼具艺术幻想感，夸张的广角透视效果，耀光，反射，极致的光影，强引力，吞噬",
    "sequential_image_generation": "disabled",
    "response_format": "url",
    "size": "2K",
    "stream": false,
    "watermark": true
}'

3. 对 经营分析 进行改造：涉及页面pages/ai-menu，云函数analytics。所有Prompt模板等存数据库或统一到配置文件。
存数据库或配置文件是为了方便更新和迭代。如果需要新建数据表，请告诉我步骤 -->

TODO
1. 解决pages/my-recipes/my-recipes的AI创建配方页面口味偏好不能选中或选中无反应的问题
2. 对 AI创建配方 进行改造：涉及页面pages/my-recipes/my-recipes，云函数recipes。所有flavors、base等存数据库或统一到配置文件。添加一些prompt额外要求由用户自定义输入的功能。直接调用阿里云百炼工作流应用API（此工作流已包含提示词优化等流程）

pages/recipe-detail/recipe-detail和pages/collection-detail/collection-detail页面
1. 去掉view(class="rd-nav")，Title直接设置为navigationBarTitleText
2. 优化不同尺寸图片的显示

添加一个管理员（_openid=='osgVb13vGJMbLpDbN2VOilX83epU'）批量上传导入配方的功能
入口：在我的页面下方显示一栏"管理"，可批量上传配方（以json文件的方式，如iba_cocktails_zh.json）
配方json文件格式如下：
{"name": "汤米的玛格丽特", "emoji": "🌵", "base": "龙舌兰", "style": "新时代", "abv": 20, "desc": "胡利奥·贝尔梅霍的龙舌兰焦点改良版——龙舌兰、青柠与龙舌兰蜜。", "ingredients": [{"amount": "60ml", "name": "100%龙舌兰"}, {"amount": "30ml", "name": "新鲜青柠汁"}, {"amount": "15ml", "name": "龙舌兰蜜"}], "steps": ["将所有原料加冰倒入摇壶", "用力摇匀", "滤入装有冰块的岩石杯"], "notes": "无盐圈，无橙皮酒。让龙舌兰的风味闪耀。创作于旧金山汤米墨西哥餐厅。", "isAI": false, "isClone": false, "isOriginal": true, "category": "The New Era", "source": "IBA官方", "isPublic": true}
{"name": "沙皇菲兹", "emoji": "🫧", "base": "金酒", "style": "新时代", "abv": 14, "desc": "俄罗斯风情的紫罗兰柠檬气泡，以香槟收尾。", "ingredients": [{"amount": "40ml", "name": "金酒"}, {"amount": "20ml", "name": "紫罗兰利口酒"}, {"amount": "20ml", "name": "新鲜柠檬汁"}, {"amount": "10ml", "name": "糖浆"}, {"amount": "60ml", "name": "香槟"}], "steps": ["将金酒、紫罗兰利口酒、柠檬汁和糖浆加冰摇匀", "滤入冰镇香槟杯", "注满香槟"], "notes": "紫罗兰利口酒将这款酒变成令人惊叹的紫蓝色。", "isAI": false, "isClone": false, "isOriginal": true, "category": "The New Era", "source": "IBA官方", "isPublic": true}
对齐本recipes数据表字段，保留category和source字段值为tags（recipes数据表新增字段）

1. 实现pages/my-recipes/my-recipes发现/我的/收藏中的配方/合集的分页功能
2. 删除pages/my-recipes/my-recipes发现中的配方/合集的复制功能
3. 实现pages/my-recipes/my-recipes我的/收藏中的配方的批量选择后加入合集、删除功能

claude --resume 41f5b270-24b7-4d02-b298-699db8bbe15c

修复bug: 
1. 分页功能仍不能正确实现，点击 加载更多 但请求的 offset总为0
2. 删除pages/recipe-detail/recipe-detail页面和pages/collection-detail/collection-detail页面 复制功能
3. 批量选择的样式还有大问题

标签按种类分
发现页:
按基酒分/按风味分/按标签分/(是否)AI生成
我的页:
按基酒分/原创或AI生成/按来源分(source)
收藏页:
按基酒分/原创或AI生成/按来源分(source)
先分析每个页面应该添加的标签分类，再计划实施

"我的页"添加"是否已公开"
"按来源分"代替"原创或AI生成"除了 全部 / 原创 / AI生成 / 克隆 动态添加标签（有的配方source非空比如为"IBA官方"等）
"发现页"的风味行和标签行允许同时各选一个 chip
