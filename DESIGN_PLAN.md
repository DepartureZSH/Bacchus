# Bacchus 设计系统规划文档

> 版本 v1.0 · 2026-04-08  
> 面向：前端重构 / 视觉优化  
> 范围：全局 `app.wxss` + 各页面 `.wxss`

---

## 一、设计愿景

**主题方向：Velvet Speakeasy（丝绒禁酒令）**

Bacchus 是罗马酒神之名，面向的是精品小酒馆经营者。当前设计功能完整，但视觉语言趋于"深色 App 通用模板"——缺乏品牌记忆点。

新方向围绕**午夜私人酒吧**的感官体验展开：
- 背景像琥珀色光线打在深色皮革上——不是冷灰，而是暖黑；
- 金色不是装饰，而是铜器和烛光的自然反射；
- 排版有层次感，像高档酒单而非 App 列表；
- 动效克制但精确，像调酒师优雅地倒酒，而非弹出提示框。

核心词：**Warm · Precise · Intimate · Craft**

---

## 二、现状审计（问题清单）

### 2.1 颜色混乱

当前代码中同一语义颜色存在**多个近似但不完全一致的值**，分散在各 `.wxss` 文件中：

| 问题 | 当前值（已发现） | 语义 |
|------|-----------------|------|
| 次要文字 | `#9a98a0` / `#9a99a3` / `#9a9a9a` | 应统一 |
| 暗灰文字 | `#6e6d76` / `#6e6d78` / `#6b6a74` | 应统一 |
| 卡片背景 | `#16181f` / `#1a1b24` | 应统一 |
| 提升面 | `#1e2029` / `#16181f`（两者互用） | 层级不清 |
| 分隔线 | `#2a2d38` / `rgba(255,255,255,0.06)` | 应统一 |
| 金色主色 | `#c9a96e` / `#e8c07a` / `#a67c3e` | 缺少明确梯度命名 |

### 2.2 圆角无系统

当前已出现以下 border-radius 值：`8rpx` `12rpx` `14rpx` `16rpx` `20rpx` `22rpx` `24rpx` `28rpx` `32rpx` `40rpx` `50%`，共 11 种，无规律。

### 2.3 字体无个性

```css
font-family: -apple-system, PingFang SC, Helvetica Neue, sans-serif;
```
全局使用系统字体，与品牌调性不符。微信小程序无法加载 Web 字体，但可通过 **字重 + 字号比例 + 字距** 建立层级，与现状相比有显著提升空间。

### 2.4 CSS 变量缺失

所有颜色、间距、圆角均为硬编码值。注释中提到"小程序不支持 `:root`"，但 `page {}` 选择器**可以定义 CSS 变量**，子元素通过继承使用，绝大多数场景有效。已有 `page {}` 选择器但未用于定义变量。

### 2.5 重复类定义

以下类在多个文件中**重复定义，内容不同**，存在隐性覆盖风险：

| 类名 | 定义位置 |
|------|---------|
| `.section-header` `.section-title` `.section-link` | `app.wxss` + `ai-menu.wxss` |
| `.step-row` `.step-num` `.step-text` | `my-recipes.wxss` + `ai-menu.wxss` |
| `.notes-text` | `my-recipes.wxss` + `ai-menu.wxss` |
| `.ing-row` | `my-recipes.wxss` + `ai-menu.wxss` |
| `.search-input` `.search-ph` | `my-recipes.wxss` + 多处 |

### 2.6 动效系统薄弱

- 仅有 loading 三点弹跳、骨架屏 shimmer、AI 抽屉 slide-up
- 缺少：卡片展开过渡、tab 切换过渡、筛选面板展开动效、按钮按压反馈
- Chip 选中仅有颜色变化，无任何缓动

### 2.7 背景无深度

所有页面背景为纯色 `#0d0e12`，缺乏质感和层次。

### 2.8 间距无节奏

常见间距值（rpx）：`8` `10` `12` `14` `16` `18` `20` `24` `28` `32` `36` `40` `44` `48` `60`，无明确的基准模数。

---

## 三、新设计语言定义

### 3.1 颜色系统（CSS 变量方案）

写入 `app.wxss` 的 `page {}` 选择器：

```css
page {
  /* ── 基础背景层（暖黑三层）── */
  --clr-bg-base:    #0c0d10;   /* 最深：页面底色（从冷黑偏暖）*/
  --clr-bg-surface: #15171e;   /* 卡片：统一替代 #16181f */
  --clr-bg-raised:  #1d1f28;   /* 提升面：统一替代 #1e2029 */
  --clr-bg-overlay: #252838;   /* 最高层：模态、输入框 */

  /* ── 边框层 ── */
  --clr-border-sub:  rgba(255,255,255,0.05);  /* 极弱分隔 */
  --clr-border-mid:  rgba(255,255,255,0.10);  /* 常规边框（替代 #2a2d38）*/
  --clr-border-str:  rgba(255,255,255,0.18);  /* 强调边框 */

  /* ── 文字层 ── */
  --clr-text-primary:   #f2efe9;   /* 主文字（略暖）*/
  --clr-text-secondary: #9a98a2;   /* 次要文字（统一）*/
  --clr-text-muted:     #5e5d68;   /* 弱文字 */
  --clr-text-disabled:  #3a3944;   /* 禁用 */

  /* ── 金铜主色（Amber Copper）── */
  --clr-gold-bright: #e2b86a;   /* 最亮高光 */
  --clr-gold-main:   #c9a45a;   /* 主色（比现有略深铜感）*/
  --clr-gold-dim:    #9a7a3e;   /* 按下态 / 深色 */
  --clr-gold-tint:   rgba(201,164,90,0.10);  /* 背景填充 */
  --clr-gold-border: rgba(201,164,90,0.30);  /* 边框色 */

  /* ── 语义色 ── */
  --clr-success: #4caf84;
  --clr-danger:  #e05c5c;
  --clr-warn:    #e09a3a;
  --clr-ai:      #8fa8f8;   /* AI 标签蓝紫 */

  /* ── 阴影 ── */
  --shadow-card:   0 4rpx 24rpx rgba(0,0,0,0.35);
  --shadow-drawer: 0 -8rpx 48rpx rgba(0,0,0,0.6);
  --shadow-gold:   0 4rpx 20rpx rgba(201,164,90,0.25);
}
```

> **迁移策略**：用全局替换将 `#16181f` → `var(--clr-bg-surface)`、`#1e2029` → `var(--clr-bg-raised)`、`#2a2d38` → `var(--clr-border-mid)`、`#c9a96e` → `var(--clr-gold-main)` 等，按文件批量处理。

---

### 3.2 圆角系统（7 级）

```css
page {
  --radius-xs:  8rpx;    /* 内部小元素：badge、dot */
  --radius-sm:  14rpx;   /* 小型标签、pill */
  --radius-md:  20rpx;   /* 普通按钮、chip */
  --radius-lg:  28rpx;   /* 卡片内嵌区块 */
  --radius-xl:  36rpx;   /* 主卡片 */
  --radius-2xl: 48rpx;   /* 抽屉顶部圆角 */
  --radius-full: 9999rpx; /* 完整圆形（替代 40rpx 胶囊）*/
}
```

**映射说明**：

| 现有值 | 建议替换 | 场景 |
|--------|---------|------|
| `8rpx` | `--radius-xs` | tag、badge |
| `12rpx` `14rpx` | `--radius-sm` | pill、小chip |
| `16rpx` `20rpx` | `--radius-md` | 按钮、搜索栏 |
| `24rpx` `28rpx` | `--radius-lg` | 内嵌区块 |
| `32rpx` | `--radius-xl` | 主卡片 |
| `40rpx` | `--radius-full` | 胶囊chip |

---

### 3.3 间距系统（基准 8rpx）

```css
page {
  --space-1:  8rpx;
  --space-2:  16rpx;
  --space-3:  24rpx;
  --space-4:  32rpx;
  --space-5:  40rpx;
  --space-6:  48rpx;
  --space-8:  64rpx;
  --space-10: 80rpx;

  /* 页面水平边距 */
  --page-x: 28rpx;
}
```

---

### 3.4 字体系统

微信小程序无法使用 Web 字体，但可通过以下手段建立层级：

```css
page {
  /* 字体栈：优先 PingFang 展示字重，iOS/Android 均有效 */
  font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif;
  
  /* 字号层级（减少到 6 级）*/
  --text-xs:   20rpx;   /* 辅助标注 */
  --text-sm:   24rpx;   /* 次要文字、标签 */
  --text-base: 28rpx;   /* 正文 */
  --text-md:   32rpx;   /* 卡片标题 */
  --text-lg:   40rpx;   /* Section 标题 */
  --text-xl:   52rpx;   /* 大标题（详情页）*/

  /* 字重 */
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-bold:    700;

  /* 字距（中文场景）*/
  --tracking-wide: 2rpx;   /* 全大写标注、标签 */
  --tracking-xl:   4rpx;   /* 主按钮文字 */
}
```

---

### 3.5 动效系统

```css
page {
  /* 缓动曲线 */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);    /* 弹入 */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* 轻弹性 */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);      /* 平滑 */

  /* 时长 */
  --dur-fast:   150ms;   /* 按压、颜色变化 */
  --dur-base:   250ms;   /* 展开、切换 */
  --dur-slow:   380ms;   /* 抽屉、页面过渡 */
}
```

---

## 四、全局（app.wxss）改造

### 4.1 背景增加微纹理

微信小程序支持 `background-image` SVG data URL，可用 noise 伪纹理增加质感：

```css
page {
  background-color: var(--clr-bg-base);
  /* 叠加极细噪点：用 SVG feTurbulence 生成，透明度 3% 即可 */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
}
```

> **降级安全**：若性能有影响可去掉，颜色方案本身已优于现状。

### 4.2 卡片增加层次阴影

```css
.card {
  background: var(--clr-bg-surface);
  border: 1.5rpx solid var(--clr-border-sub);   /* 从 2rpx 减薄 */
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);   /* 新增阴影层次 */
}
```

### 4.3 主按钮优化

```css
.btn-primary {
  background: linear-gradient(145deg, var(--clr-gold-bright), var(--clr-gold-dim));
  color: #0c0d10;
  border-radius: var(--radius-full);
  padding: 32rpx;
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-xl);
  /* 新增：金色光晕 */
  box-shadow: var(--shadow-gold);
  /* 新增：按压动效 */
  transition: transform var(--dur-fast) var(--ease-out),
              box-shadow var(--dur-fast) var(--ease-out);
}
.btn-primary:active {
  transform: scale(0.97);
  box-shadow: none;
}
```

---

## 五、组件级优化

### 5.1 Filter Chip

**当前问题**：选中态仅改颜色，无过渡；border 太粗（2rpx）；圆角 40rpx 略尖。

```css
/* 推荐 */
.filter-chip {
  flex-shrink: 0;
  padding: 10rpx 26rpx;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border: 1.5rpx solid var(--clr-border-mid);
  color: var(--clr-text-muted);
  background: var(--clr-bg-raised);
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out),
              background var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}
.chip-on {
  background: var(--clr-gold-tint);
  border-color: var(--clr-gold-border);
  color: var(--clr-gold-main);
  /* 新增：轻微内阴影 */
  box-shadow: inset 0 1rpx 0 rgba(226,184,106,0.15);
}
```

### 5.2 配方卡片（Recipe Card）

**当前问题**：`.user-card-border` 使用 `border-left: 6rpx solid` 感觉廉价；所有卡片视觉重量相同。

**优化方案**：
- 去掉 `border-left` 粗边，改为左上角极小的金色角标（伪元素）
- 提升字号层级对比

```css
.recipe-card {
  padding: 28rpx;
  overflow: hidden;
  position: relative;
}

/* 替代 border-left 的精致角标 */
.user-card-border::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 3rpx;
  height: 60%;
  background: linear-gradient(to bottom, var(--clr-gold-main), transparent);
  border-radius: 0 0 2rpx 0;
}

/* 配方名字号提升 */
.rc-name {
  font-size: var(--text-md);   /* 32rpx，从 30 提升 */
  font-weight: var(--weight-bold);
  color: var(--clr-text-primary);
  letter-spacing: 0.5rpx;
}
```

### 5.3 Tag / Badge

**当前问题**：圆角 `8rpx` 太方正，多种同语义的 tag 实现不一致。

```css
/* 统一基础 tag */
.tag {
  padding: 4rpx 14rpx;
  border-radius: var(--radius-sm);   /* 14rpx，比现有 8rpx 更柔 */
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-wide);
}

/* AI 生成：蓝紫色增加边框质感 */
.tag-ai {
  background: rgba(143,168,248,0.12);
  color: var(--clr-ai);
  border: 1rpx solid rgba(143,168,248,0.25);
}

/* 原创：金色系 */
.tag-original {
  background: var(--clr-gold-tint);
  color: var(--clr-gold-bright);
  border: 1rpx solid var(--clr-gold-border);
}
```

### 5.4 Drawer（抽屉）

**当前问题**：drawer handle 为圆角矩形（`#2a2d38`），过于显眼；缺少顶部渐变遮罩。

```css
/* 更精致的 handle */
.ai-drawer-handle {
  width: 48rpx;   /* 略窄 */
  height: 5rpx;   /* 略细 */
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.18);
  margin: 16rpx auto 28rpx;
}

/* 抽屉顶部加渐变遮罩（提示可滚动）*/
.ai-drawer::before {
  content: '';
  position: sticky;
  top: 0;
  display: block;
  height: 2rpx;
  background: linear-gradient(to right, transparent, var(--clr-gold-dim), transparent);
  opacity: 0.5;
}
```

### 5.5 Tab 指示线

**当前问题**：黄色下划线可以更精致。

```css
.top-tab-line {
  position: absolute;
  bottom: 0;
  left: 25%; width: 50%;
  height: 3rpx;   /* 从 4 减到 3，更细腻 */
  background: linear-gradient(to right, transparent, var(--clr-gold-main), transparent);
  border-radius: var(--radius-full);
}
```

### 5.6 步骤序号圆

**当前问题**：`#1e2029` 背景 + `#c9a96e` 文字，在暗背景上较平。

```css
.step-num {
  width: 40rpx; height: 40rpx;
  border-radius: 50%;
  background: var(--clr-gold-tint);
  border: 1.5rpx solid var(--clr-gold-border);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--text-xs);
  color: var(--clr-gold-bright);
  font-weight: var(--weight-bold);
  flex-shrink: 0;
}
```

### 5.7 Sticky Header 分隔线

**当前问题**：`border-bottom: 2rpx solid #1e2029` 太粗、颜色太亮。

```css
.discover-sticky-hd,
.mine-sticky-hd,
.fav-sticky-hd {
  position: sticky;
  top: 88rpx;
  z-index: 8;
  background: var(--clr-bg-base);
  /* 替换 border-bottom 为底部渐变阴影，更自然 */
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.4);
}
```

---

## 六、页面级优化建议

### 6.1 my-recipes（发现页）

**发现页卡片**：当前发现页配方/合集卡片与「我的」卡片同款，应差异化。

```
建议：发现页卡片增加作者信息行的左侧彩色竖线装饰
- 每个合集按 tags[0] 取一个预设颜色（如热带=橙、清爽=青、甜蜜=粉）
- 卡片封面图未加载时用 emoji + 径向渐变背景（而非纯色）
```

**筛选面板**：当前展开后和折叠后高度落差大，建议：
- 展开动效改用 `max-height` 过渡（需固定最大高度），或直接用 `transform: translateY` + `opacity`

### 6.2 collection-detail（合集详情）

**Hero 区**：图片下方渐变`transparent → #0d0e12`效果好，建议在**无图时**用更有设计感的占位：

```
- 大 emoji（现有）保留
- 背景改为带噪点的径向渐变（从 #1a1c26 到 #0c0d10）
- 在 emoji 后方叠加一个极淡的放射状纹（用 SVG 背景）
```

**配方展开区**：每条配方卡片背景 `#1e2029` 略显同质，建议：
- 选中/展开的配方卡片加 `box-shadow: 0 0 0 1.5rpx var(--clr-gold-border)` 边框高亮

### 6.3 ai-menu（AI 创作页）

**AI 生成按钮**：当前渐变方向 `135deg`，建议改 `to bottom right` + 加内光：

```css
.ai-submit-btn {
  background: linear-gradient(135deg, var(--clr-gold-bright) 0%, var(--clr-gold-dim) 100%);
  /* 新增内光效果 */
  box-shadow: inset 0 1rpx 0 rgba(255,255,255,0.2),
              var(--shadow-gold);
}
```

**骨架屏**：shimmer 动效颜色过亮（`#32354a` 亮部），建议：
```css
/* 暗化亮部，更融入背景 */
.sk-line {
  background: linear-gradient(90deg, #1d1f28 25%, #252838 50%, #1d1f28 75%);
}
```

### 6.4 dashboard（首页）

**指标卡片**：当前 `metric-card` 全部同等视觉重量，建议最重要指标（如库存告急数）做强调：
- 危险指标卡片加 `border-color: rgba(224,92,92,0.35)` + 左侧红色渐变竖线

---

## 七、重复定义清理方案

以下类建议从各页面 wxss 中**删除**，统一由 `app.wxss` 提供：

| 类名 | 建议保留位置 | 各页面操作 |
|------|------------|----------|
| `.section-header/title/link` | `app.wxss` | 删除 `ai-menu.wxss` 中的重复定义 |
| `.step-row/num/text` | `app.wxss` | 删除 `ai-menu.wxss` 和 `my-recipes.wxss` 中的重复定义 |
| `.notes-text` / `.notes-row` | `app.wxss` | 合并差异后统一 |
| `.ing-row` | `app.wxss` | 注意检查字段差异 |
| `.empty-full` | `app.wxss` | 各页面共用 |

---

## 八、实施优先级

### Phase 1 — 基础系统（高收益，低风险）⭐⭐⭐

1. `app.wxss`：写入所有 CSS 变量（color / radius / spacing / motion tokens）
2. `app.wxss`：卡片 `box-shadow` 和 border 细化
3. `app.wxss`：主按钮 active 态、`box-shadow`
4. `my-recipes.wxss` / `ai-menu.wxss`：清理重复类定义

### Phase 2 — 组件提升（中等收益）⭐⭐

5. 全局 filter-chip 过渡动效
6. 全局 tag / badge 圆角统一
7. Drawer handle 细化
8. Tab 指示线渐变化
9. Step-num 金色填充

### Phase 3 — 视觉深化（品牌感提升）⭐

10. 页面背景 noise 纹理（测试性能后决定）
11. 发现页卡片差异化（颜色系统）
12. collection-detail Hero 无图占位优化
13. Dashboard 指标卡片强调态

---

## 九、微信小程序特殊约束说明

| 特性 | 约束 | 解决方案 |
|------|-----|---------|
| CSS 变量 | `page {}` 可定义，子元素可继承；部分内置组件不继承 | 对 `input`/`button` 保留硬编码备用值 |
| Web 字体 | 不支持加载外部字体 | 靠字重 + 字号比例 + 字距建立层级 |
| `backdrop-filter: blur` | iOS 支持，Android 微信可能无效 | 加不透明度备用背景色降级 |
| `box-shadow` | 支持，但 `inset` 在部分场景有渲染 bug | 测试后决定是否用 `border` 代替 |
| CSS `transition` | 支持，但 `height: auto` 无法过渡 | 用 `max-height` 或 `transform` 代替 |
| SVG background-image | 支持 data URL | 注意 URL 编码 |
| `position: sticky` | 支持，需父元素不设 `overflow: hidden` | 已有使用，注意检查滚动容器 |

---

## 附录：核心颜色速查表

```
背景基底    #0c0d10   → var(--clr-bg-base)
卡片面      #15171e   → var(--clr-bg-surface)
提升面      #1d1f28   → var(--clr-bg-raised)
覆层        #252838   → var(--clr-bg-overlay)

边框弱      rgba(255,255,255,0.05)  → var(--clr-border-sub)
边框中      rgba(255,255,255,0.10)  → var(--clr-border-mid)

主文字      #f2efe9   → var(--clr-text-primary)
次文字      #9a98a2   → var(--clr-text-secondary)
弱文字      #5e5d68   → var(--clr-text-muted)

金色主      #c9a45a   → var(--clr-gold-main)
金色亮      #e2b86a   → var(--clr-gold-bright)
金色深      #9a7a3e   → var(--clr-gold-dim)
金色填充    rgba(201,164,90,0.10)  → var(--clr-gold-tint)
金色边框    rgba(201,164,90,0.30)  → var(--clr-gold-border)

成功绿      #4caf84   → var(--clr-success)
危险红      #e05c5c   → var(--clr-danger)
警告橙      #e09a3a   → var(--clr-warn)
AI 蓝紫     #8fa8f8   → var(--clr-ai)
```
