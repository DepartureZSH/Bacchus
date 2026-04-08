// 经营分析 AI 建议配置文件
// 修改此文件后重新部署 analytics 云函数即可生效，无需修改 index.js

module.exports = {

  // ── 百炼模型 ──────────────────────────────────────────────
  DEFAULT_MODEL: 'qwen-plus',

  // ── 有数据时的 Prompt 模板 ────────────────────────────────
  buildAdvicePrompt({ shopName, periodLabel, kpi, topIngredients, stockDist }) {
    const topStr = (topIngredients || []).length
      ? topIngredients.slice(0, 3).map(i => `${i.name}（¥${i.cost}）`).join('、')
      : '暂无数据'
    const raw = (stockDist && stockDist.raw) || { ok: 0, warn: 0, danger: 0 }

    return `你是一名专业的小酒馆经营顾问。请根据以下真实经营数据，给出 3 条具体、可执行的经营建议。

店铺：${shopName}
分析周期：本${periodLabel}

经营数据：
- 营业额：¥${kpi.revenueNum}（${kpi.revenueTrend}）
- 毛利率：${kpi.margin}%
- 出杯数：${kpi.cups} 杯
- 原料成本率：${kpi.costRate}%
- 高成本原料：${topStr}
- 库存状态：正常 ${raw.ok} 种，偏低 ${raw.warn} 种，告急 ${raw.danger} 种

每条建议格式（严格 JSON）：{"icon":"emoji","title":"标题10字内","text":"正文60字内"}

请只返回 JSON 数组，不要其他内容。示例：[{"icon":"📈","title":"...","text":"..."}]`
  },

  // ── 无数据时的引导建议 ────────────────────────────────────
  ONBOARDING_ADVICE: [
    { icon: '📝', title: '开始记录营业数据', text: '建议每日录入营业额和出杯数，让系统帮你追踪经营趋势。' },
    { icon: '📦', title: '完善库存信息',     text: '为每种原料设置单位成本价，系统可自动估算毛利率。' },
    { icon: '🎯', title: '利用 AI 酒单功能', text: '根据现有库存让 AI 推荐特调，减少积压、提升周转效率。' },
  ],
}
