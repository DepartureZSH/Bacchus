# Bacchus 鸡尾酒AI仓管 · 微信小程序 Demo

## 快速开始

1. 打开 **微信开发者工具**
2. 选择「导入项目」→ 选择本目录
3. AppID 填写你的小程序 AppID（或使用测试号）
4. 点击「编译」即可运行

## 目录结构

```
bacchus-miniapp/
├── app.js              全局逻辑 & 登录状态管理
├── app.json            页面路由 & TabBar 配置
├── app.wxss            全局样式 & Design Tokens
├── sitemap.json
│
├── data/
│   └── ingredients.js  ← 18 条预置原料数据（含3条低库存）
│
├── utils/
│   └── helper.js       工具函数（状态计算、分组等）
│
└── pages/
    ├── login/           登录页
    ├── dashboard/       首页 Dashboard
    ├── inventory/       库存列表页
    ├── inventory-detail/ 原料详情 + 入库/出库
    ├── ai-menu/         AI 酒单生成页
    └── profile/         我的
```

## 预置数据说明

| 原料             | 库存  | 阈值   | 状态     |
|----------------|-------|--------|----------|
| 金酒            | 150ml | 500ml  | 🔴 严重不足 |
| 青柠汁（新鲜）   | 120ml | 400ml  | 🔴 告急   |
| 薄荷叶（新鲜）   | 1把   | 3把    | 🟡 偏低   |
| 其余 15 条      | —    | —      | ✅ 正常   |

## TabBar 图标说明

`app.json` 中 tabBar 图标路径为 `assets/tab/*.png`，
微信开发者工具需要在项目根目录下创建对应图片，
**或将 tabBar.list 中的 iconPath/selectedIconPath 字段删除**（小程序允许纯文字 TabBar）。

## Demo 演示路线

登录 → Dashboard（看预警）→ 库存列表 → 点击金酒（详情+入库）→ AI酒单（选高利润/果味→生成）→ 我的
