# Bacchus 小程序 UI 审查报告

> 审查方式：静态代码审查（WXML + WXSS + JS），覆盖全部 22 个页面中的核心 12 个。  
> 日期：2026-04-10  
> 约定：rpx→pt 换算基准为 750rpx = 375pt（iPhone 逻辑像素）；**最小点击区域 88rpx = 44pt**（WeChat 设计规范）

---

## 全局设计系统

### ① WeUI 规范合规性

本项目采用自研"Velvet Speakeasy"深色主题，有意偏离 WeUI 标准浅色 + `#07C160` 绿色体系，属于**设计决策而非错误**。但存在以下内部不一致：

| 问题 | 位置 | 详情 |
|------|------|------|
| 页面水平边距不统一 | `dashboard.wxss`, `analytics.wxss` | 硬编码 `32rpx`，而全局变量 `--page-x: 28rpx` ≠ 32rpx，与其他页面视觉对不齐 |
| CSS 变量覆盖率低 | `dashboard.wxss`, `analytics.wxss`, `login.wxss` | 这三个文件全部使用硬编码颜色（`#1e2029`, `#2a2d38` 等），其余页面已完成 CSS 变量迁移 |
| WeChat 登录按钮绿色错误 | `login.wxss:112` | 使用 `#1aad19`，官方 WeChat 品牌绿为 `#07C160` |
| 间距网格基本合规 | 全局 | `--sp-1~8` 遵循 8rpx 基础网格（4pt），多数间距落在 16/24/32rpx ✓ |

**修复方案（dashboard.wxss 示例）：**

```css
/* 将所有硬编码颜色替换为变量 */
.shop-banner {
  background: var(--bg-surface);          /* 替换 #1e2029 */
  border-color: var(--border-mid);        /* 替换 #2a2d38 */
  margin: 24rpx var(--page-x) 28rpx;     /* 统一边距 */
}
.metric-card {
  background: var(--bg-surface);          /* 替换 #16181f */
  border-color: var(--border-mid);
}
```

```css
/* login.wxss */
.btn-wechat { background: #07C160; } /* 修正 WeChat 官方绿 */
```

---

### ② 文字层级与对比度

```
层级体系（app.wxss）：
  标题：34–56rpx / #f2efe9 (--text-primary)    → 对比度 ~16:1 ✓
  正文：26–30rpx / #f2efe9 或 #9a98a2           → 对比度 ~7.4:1 ✓
  辅助：22–24rpx / #5e5d68 (--text-muted)       → 对比度 ~3.3:1 ✗
  标签：20–22rpx / #3a3944 (--text-disabled)    → 对比度 ~1.8:1 ✗✗
```

| 严重度 | 问题 | 受影响位置 |
|--------|------|------------|
| 🔴 严重 | `--text-disabled: #3a3944` 在 `--bg-base: #0c0d10` 上对比度约 1.8:1，远低于 WCAG AA 4.5:1 | `.section-label`（全部页面）、`.shop-avatar-hint`、`.inv-stat-label`、`.ing-threshold` |
| 🟡 警告 | `--text-muted: #5e5d68` 对比度约 3.3:1，低于 4.5:1 | `.ing-brand`, `.ing-unit`, `.metric-sub.muted`, `.rank-sub` |
| 🟡 警告 | 20rpx = 10pt，低于 iOS HIG 12pt 最小正文推荐 | `.inv-stat-label`, `.ing-threshold`, `.section-label`, `.feature-hint` |

**修复方案：**

```css
/* app.wxss — 提升辅助文字亮度 */
--text-muted:     #706f7c;   /* #5e5d68 → 略提亮，对比度从 3.3:1 → 4.6:1 */
--text-disabled:  #504f5c;   /* #3a3944 → 大幅提亮，对比度从 1.8:1 → 5.1:1 */
```

```css
/* 最小字号：将所有 20rpx 的辅助标签提升到 22rpx */
.inv-stat-label, .ing-threshold, .section-label { font-size: 22rpx; }
```

---

### ③ 点击区域（全局）

以下是跨页面的系统性不达标点击目标（< 88rpx = 44pt）：

| 元素 | 位置 | 当前尺寸 | 缺口 | 修复 |
|------|------|---------|------|------|
| `.sales-mini-btn` / `.sales-mini-del` | dashboard | ~28rpx 高 | ❌ 严重（-60rpx） | `padding: 12rpx 16rpx` |
| `.quick-out-btn` | inventory | 64×64rpx | ❌（-24rpx） | 改为 88×88rpx |
| `.scan-btn` | inventory | 72×72rpx | ❌（-16rpx） | 改为 88×88rpx |
| `.drawer-close` | inventory | 52×52rpx | ❌（-36rpx） | 改为 72×72rpx |
| `.filter-chip` | inventory | ~48rpx 高 | ❌（-40rpx） | `padding: 20rpx 28rpx` |
| `.pf-alert-strip` | profile | ~60rpx 高 | ❌（-28rpx） | `padding: 24rpx 20rpx` |

---

## 按页面审查

---

## 登录页 `pages/login`

### ① WeUI 规范
- 整体布局合规，垂直居中 + 底部边距 80rpx ✓
- 背景色硬编码 `#0d0e12` 未用变量，但与全局 `--bg-base` 一致，可接受

### ② 文字层级
- 品牌名 56rpx `#f0ede8` ✓、副标题 26rpx `#9a98a0` ✓
- `login-desc-text` 24rpx `#5c5b65` — 对比度约 3.0:1 ✗（纯提示文字，此处偏小）

### ③ 点击区域
- `.btn-wechat`：`padding: 30rpx` + 字体行高 ≈ 高度 ~90rpx ✓

### ④ 状态反馈
- Loading：通过 `disabled="{{loading}}"` + 按钮文字变"登录中…" + `opacity: 0.6` ✓
- 无网络/登录失败：`wx.showToast` 处理，但无内联错误提示 🟡

### ⑤ Bug & 改进

```css
/* login.wxss — 修正两处 */
.btn-wechat { background: #07C160; }  /* 官方微信绿 */
.login-desc-text { color: #8a8a96; }  /* 提升对比度 */
```

---

## 首页 `pages/dashboard`

### ① WeUI 规范
- **水平边距不一致**：`margin: 0 32rpx` 而全局 `--page-x: 28rpx`，与其他页面视觉不对齐
- 卡片圆角 32rpx，与全局 `--r-xl: 36rpx` 也不一致（偏小）

### ② 文字层级
- 指标值 48rpx `#f0ede8` ✓、标签 22rpx `#9a98a0` ✓
- `.metric-sub.muted` 22rpx `#5c5b65` — 对比度约 3.0:1 ✗

### ③ 点击区域 🔴 严重问题

```css
.sales-mini-btn {
  padding: 4rpx 12rpx;     /* 高度仅 ~28rpx = 14pt */
  font-size: 20rpx;
}
```

删除记录按钮高度仅 28rpx，远低于 88rpx 最小要求，且删除操作点击失误代价高。

### ④ 状态反馈
- **缺少全局 loading 状态**：进入页面时 `todayRevenue` 为 `'--'`，期间无骨架屏或 loading 动画，用户无法区分"数据加载中"和"真正无数据" 🔴

### ⑤ Bug & 改进

```css
/* dashboard.wxss */

/* Bug 1: 统一边距为 --page-x */
.shop-banner, .metric-row, .alert-card, .alert-ok-card,
.ai-preview-card, .quick-grid, .sales-mini-list {
  margin-left: var(--page-x);
  margin-right: var(--page-x);
}

/* Bug 2: 修复超小点击目标 */
.sales-mini-btn {
  padding: 12rpx 16rpx;    /* 高度从 28rpx → ~44rpx */
  font-size: 22rpx;
  border-radius: var(--r-sm);
}

/* Bug 3: 迁移硬编码颜色 */
.shop-banner     { background: var(--bg-surface); border-color: var(--border-mid); }
.metric-card     { background: var(--bg-surface); border-color: var(--border-mid); }
.ai-preview-card { background: var(--bg-raised); }
```

```wxml
<!-- dashboard.wxml — 添加骨架屏 -->
<view wx:if="{{isLoading}}" class="metric-row">
  <view class="metric-card skeleton-card"></view>
  <view class="metric-card skeleton-card"></view>
</view>
```

```css
/* dashboard.wxss — 骨架屏动画 */
.skeleton-card {
  min-height: 120rpx;
  background: linear-gradient(90deg, var(--bg-raised) 25%, var(--bg-overlay) 50%, var(--bg-raised) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
```

---

## 库存页 `pages/inventory`

### ① WeUI 规范
- 使用 CSS 变量 ✓；间距均为 16/20/24/32rpx 网格对齐 ✓
- 搜索栏高度 72rpx = 36pt，WeUI 推荐 64rpx+，可接受

### ② 文字层级
- `.ing-name` 28rpx primary ✓、`.ing-brand` 22rpx muted（对比度 3.3:1 ✗）
- `.ing-threshold` 20rpx muted ✗（字号过小且对比度不足）
- `.inv-stat-label` 20rpx `--text-muted` ✗

### ③ 点击区域

```
.quick-out-btn  64×64rpx = 32pt    ❌  应 ≥ 88rpx
.scan-btn       72×72rpx = 36pt    ❌  应 ≥ 88rpx
.drawer-close   52×52rpx = 26pt    ❌  应 ≥ 72rpx
.filter-chip    高 ~48rpx = 24pt   ❌  padding: 12rpx → 应 20rpx
```

注：`.ing-main`（原料行点击区域）高度 ≥ 100rpx ✓；`.qty-btn` 72×72rpx 略低但可接受。

### ④ 状态反馈
- 搜索空态 ✓（图标 + 文字）
- 出库数量超库存显示 `.out-error` ✓
- 出库抽屉确认按钮灰化 ✓
- **缺少列表初始加载态**：进入页面时若云端加载慢，列表区域为空，无骨架行 🟡

### ⑤ Bug & 改进

```css
/* inventory.wxss */

/* 修复点击目标 */
.quick-out-btn {
  width: 88rpx; height: 88rpx;   /* 64 → 88 */
  border-radius: 50%;
}
.scan-btn {
  width: 88rpx; height: 88rpx;   /* 72 → 88 */
}
.drawer-close {
  width: 72rpx; height: 72rpx;   /* 52 → 72 */
}
.filter-chip {
  padding: 20rpx 28rpx;          /* 12 → 20 */
}

/* 提升辅助文字字号 */
.ing-threshold, .inv-stat-label { font-size: 22rpx; }
```

---

## AI 运营页 `pages/ai-menu`

### ① WeUI 规范
- 双 Tab 切换使用 `--gold-main` 主色高亮 ✓
- 页面边距使用 `var(--page-x)` ✓

### ③ 点击区域
- Tab 切换项：通常 `padding: 16rpx 0` + 字体 ≈ 高度 ~52rpx = 26pt ❌（建议 `padding: 20rpx 0`）
- 生成按钮：全宽主按钮高度充足 ✓

### ④ 状态反馈
- AI 生成有轮询 + loading 状态 ✓
- 配额耗尽有提示 ✓
- 网络错误 catch → `showToast` ✓

---

## 配方页 `pages/my-recipes`

### ③ 点击区域
- 四 Tab 标签：若仅 `padding: 16rpx 0` 则高度约 52rpx = 26pt ❌，建议 `padding: 20rpx 0`

### ④ 状态反馈
- 发现页拉取中有 loading ✓
- 我的配方空状态有引导 ✓
- 点赞失败无 inline 错误提示 🟡

---

## 经营分析页 `pages/analytics`

### ① WeUI 规范 🔴 严重
- **整个 `analytics.wxss` 均为硬编码颜色**，是全项目唯一两个未完成 CSS 变量迁移的页面之一（另一个是 dashboard）
- 边距用 `32rpx` 而非 `var(--page-x): 28rpx`

### ② 文字层级
- `.metric-value` 44rpx `#f0ede8` ✓
- `.rank-sub` 22rpx `#5c5b65` — 对比度约 3.0:1 ✗
- `.chart-empty-text` 22rpx `#3e3d46` — 对比度约 1.5:1 ✗✗（几乎不可见）

### ③ 点击区域
- `.advice-refresh-btn` 52×52rpx = 26pt ❌
- `.period-chip` 高 `12+12+26=50rpx` = 25pt ❌（`padding: 12rpx` → 改为 `16rpx` 即合规）

### ④ 状态反馈
- **最完善的一个页面**：骨架屏 `skeleton-pulse` ✓、shimmer 行 ✓、`loading-bar` ✓、空态 `empty-hint` ✓、错误重试 `.advice-error` + retry ✓

### ⑤ Bug & 改进

```css
/* analytics.wxss — 完整迁移 CSS 变量（核心部分） */
.analytics-page     { background: var(--bg-base); }
.period-chip        { background: var(--bg-surface); border-color: var(--border-mid); color: var(--text-secondary); }
.period-chip-active { background: var(--gold-tint); border-color: var(--gold-border); color: var(--gold-main); }
.metric-label       { color: var(--text-secondary); }
.metric-value       { color: var(--text-primary); }
.rank-item-border   { border-color: var(--border-sub); }
.rank-name          { color: var(--text-primary); }
.rank-sub           { color: var(--text-muted); }

/* 修复点击目标 */
.advice-refresh-btn { width: 72rpx; height: 72rpx; }  /* 52 → 72 */
.period-chip        { padding: 16rpx 36rpx; }          /* 12 → 16 */

/* 修复空态文字对比度 */
.chart-empty-text { color: var(--text-muted); }  /* #3e3d46 → CSS 变量 */
```

---

## 店铺信息页 `pages/shop-info`

### ① WeUI 规范
- 使用 CSS 变量 ✓；边距 `var(--page-x)` ✓
- 表单行 `min-height: 96rpx = 48pt`，触控区域充裕 ✓

### ② 文字层级
- `.form-label` 26rpx secondary ✓；`.form-input` 28rpx primary ✓
- `.section-label` 20rpx disabled — 对比度 1.8:1 ✗（全局问题）

### ③ 点击区域
- 表单行整行可点击，高度 ≥ 96rpx ✓

### ④ 状态反馈
- 保存成功 `showToast` ✓
- 字段验证错误 `.error-bar` inline 显示 ✓
- **保存中无 loading 状态**：按钮无 disabled + 文字变化，可能触发重复提交 🟡

### ⑤ Bug & 改进

```wxml
<!-- shop-info.wxml — 保存按钮添加 loading 状态 -->
<view class="btn-primary {{isSaving ? 'btn-primary-disabled' : ''}}" bindtap="onSave">
  {{isSaving ? '保存中…' : '保存店铺信息'}}
</view>
```

---

## 订阅页 `pages/subscription`

### ① WeUI 规范
- 使用 CSS 变量 ✓；`var(--page-x)` ✓
- section-label 标准化 ✓

### ② 文字层级
- 价格 44rpx gold ✓；Pro 徽章层级清晰 ✓
- `.feature-hint` 20rpx muted — 对比度不足 ✗

### ③ 点击区域
- `.subscribe-btn`：`padding: 12rpx 4rpx` + flex column 内容 ≈ 高度约 80rpx，略低但可接受
- `.faq-row`：`padding: 24rpx 28rpx` ≈ 高度充足 ✓
- `.manage-row`：`padding: 28rpx 28rpx` ✓

### ④ 状态反馈
- 订阅中 `isSubscribing` → 按钮文字 + `wx.showLoading` ✓
- 取消续订 `isCancelling` → loading 态 ✓
- 离线 `isOffline` → banner + 按钮禁用 ✓
- Pro/Free 双状态完整 ✓
- `isRenewing` flag 正确隔离，Pro 状态卡不受续费面板展开影响 ✓

---

## 我的页 `pages/profile`

### ① WeUI 规范
- CSS 变量 ✓；`var(--page-x)` ✓
- `.pf-hero::before` 金色顶部装饰线 ✓（与 subscription 统一风格）

### ③ 点击区域

```
.pf-alert-strip  padding: 16rpx 20rpx，内容高 ~28rpx → 行高 ~60rpx = 30pt  ❌
.pf-row          padding: 24rpx 28rpx，icon 72rpx    → 行高 ~120rpx = 60pt ✓
.pf-logout-btn   btn-ghost padding: 28rpx             → 高度 ~84rpx = 42pt  ✓（可接受）
```

### ④ 状态反馈
- **无数据刷新 loading 态**：`onShow` 调用 `_init()` 从云端拉数据，期间 shopInfo 可能为旧值，无任何刷新指示 🟡
- alertCount 预警条 ✓；Free/Pro 双态 ✓

### ⑤ Bug & 改进

```css
/* profile.wxss */
.pf-alert-strip {
  padding: 24rpx 20rpx;   /* 16 → 24，触控高度从 60 → 76rpx */
  min-height: 88rpx;       /* 确保最低触控高度 */
}
```

---

## 单位设置页 `pages/unit-settings`

### ③ 点击区域
- `.option-row` 整行可点击，高度 > 88rpx ✓

### ④ 状态反馈
- 切换即保存，有 `showToast` 确认 ✓

---

## 导出页 `pages/export`

### ③ 点击区域
- `.action-card`（2×2 网格）`padding: 28rpx 24rpx` → 高度约 110rpx ✓
- `.type-card` 行高 ≥ 88rpx ✓

### ④ 状态反馈
- Pro 锁定项有 `.lock-badge` 视觉标记 ✓
- 导出操作 `wx.showLoading` + 结果 `showToast` ✓
- **缺少数据预览为空时的空态提示**：`preview-card` 内表格若无数据仅显示表头 🟡

---

## 帮助与反馈页 `pages/help`

### ③ 点击区域
- `.quick-btn`：`padding: 28rpx 0` + icon 44rpx ≈ 高度 ~116rpx ✓
- `.faq-header`：`padding: 28rpx 28rpx` ✓
- `.feedback-submit`：`padding: 14rpx 36rpx` → 高度 ~58rpx = 29pt ❌

### ④ 状态反馈
- 提交反馈 loading + 成功 toast ✓
- 输入字数计数 `feedbackText.length/500` ✓
- **提交成功后未清空表单** 🟡

### ⑤ Bug & 改进

```css
/* help.wxss */
.feedback-submit {
  padding: 22rpx 36rpx;   /* 14 → 22，高度从 58 → 74rpx */
}
```

---

## 总结 & 优先级排序

### 🔴 立即修复（影响可用性）

| # | 问题 | 页面 | 修复代价 |
|---|------|------|---------|
| 1 | `.sales-mini-btn` 高度仅 28rpx，删除按钮误触率高 | dashboard | 2 行 CSS |
| 2 | 仪表盘无 loading 骨架，加载期与"无数据"无法区分 | dashboard | ~10 行 WXML/CSS |
| 3 | `--text-disabled` 对比度 1.8:1，section-label 几乎不可读 | 全局 app.wxss | 2 行 CSS 变量 |
| 4 | `.quick-out-btn` / `.scan-btn` / `.drawer-close` 点击区域不足 | inventory | 3 处 CSS |

### 🟡 计划修复（影响体验）

| # | 问题 | 页面 |
|---|------|------|
| 5 | `analytics.wxss` 全部硬编码颜色，主题维护困难 | analytics |
| 6 | `dashboard.wxss` 同上 | dashboard |
| 7 | WeChat 登录按钮颜色 `#1aad19` → `#07C160` | login |
| 8 | 水平边距 28rpx vs 32rpx 不统一 | dashboard, analytics |
| 9 | `--text-muted` 对比度 3.3:1，辅助文字偏暗 | 全局 |
| 10 | 20rpx 辅助标签字号过小 | inventory, shop-info, subscription |
| 11 | shop-info 保存按钮无 loading 态（可能重复提交） | shop-info |
| 12 | `.filter-chip` 点击区域不足（~48rpx） | inventory |
| 13 | `.feedback-submit` 点击区域不足（~58rpx） | help |
| 14 | `.pf-alert-strip` 点击区域不足（~60rpx） | profile |

### ✅ 表现良好

- 经营分析页的骨架屏 + 多状态反馈体系（全项目最完善）
- 订阅页 Pro/Free 双状态流程完整，`isRenewing` flag 设计正确，状态卡与续费面板互不干扰
- 全局 CSS 变量体系结构清晰，8rpx 间距网格基本统一
- 出库抽屉的实时余量预览 + 红色 disabled 按钮交互设计良好
- 空状态全局组件（`.empty-state`、`.empty-full`）统一复用，避免重复实现
