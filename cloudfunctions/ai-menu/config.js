// AI酒单生成配置文件
// 修改此文件后重新部署 ai-menu 云函数即可生效，无需修改 index.js

module.exports = {

  // ── 酒单目标选项 ──────────────────────────────────────────
  GOALS: [
    { id: '高利润', label: '高利润', emoji: '💰', desc: '优先推荐高毛利配方' },
    { id: '清库存', label: '清库存', emoji: '📦', desc: '优先消耗积压原料' },
    { id: '日常',   label: '日常',   emoji: '🌅', desc: '稳定适合日常出品' },
    { id: '主题',   label: '主题',   emoji: '🎭', desc: '特色主题创意调酒' },
    { id: '随机',   label: '随机',   emoji: '🎲', desc: 'AI 自由发挥' },
  ],

  // ── 风味偏好选项 ──────────────────────────────────────────
  FLAVORS: [
    { id: '果味', label: '果味', emoji: '🍓' },
    { id: '经典', label: '经典', emoji: '🥃' },
    { id: '清爽', label: '清爽', emoji: '🌊' },
    { id: '创新', label: '创新', emoji: '✨' },
    { id: '花香', label: '花香', emoji: '🌸' },
    { id: '热带', label: '热带', emoji: '🌴' },
    { id: '随机', label: '随机', emoji: '🎲' },
  ],

  // ── 百炼工作流应用 ID ────────────────────────────────────
  // 优先使用云函数环境变量 BAILIAN_APP_ID，此处作为兜底默认值
  WORKFLOW_APP_ID: '8bb65074cb644529945aeb238d05a92e',

  // ── 单次最多返回配方数 ─────────────────────────────────────
  MAX_COCKTAILS: 4,

  // ── 工作流 biz_params 说明 ────────────────────────────────
  // 以下参数由 actionGenerate 组装后通过 biz_params 传入工作流：
  //   goal              酒单目标（如"高利润"）
  //   flavor            风味偏好（如"果味"）
  //   shop_name         店铺名称
  //   all_ingredients   所有原料，逗号分隔
  //   low_stock_items   库存不足原料 JSON 字符串
  //   output_format     固定为 "json"
  //   custom_requirement（可选）用户自定义额外要求
}
