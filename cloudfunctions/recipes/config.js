// cloudfunctions/recipes/config.js
// AI 配方生成配置
// 修改此文件后重新部署 recipes 云函数即可生效

module.exports = {

  // ── 口味偏好选项 ──────────────────────────────────────────
  FLAVOR_OPTIONS: ['酸爽', '甜蜜', '苦涩', '清爽', '烟熏', '花香', '热带', '草本'],

  // ── 基酒选项 ──────────────────────────────────────────────
  BASE_OPTIONS: ['随机', '金酒', '伏特加', '朗姆酒', '龙舌兰', '威士忌', '无酒精'],

  // ── 百炼工作流应用 ID ─────────────────────────────────────
  // 优先使用云函数环境变量 BAILIAN_RECIPE_APP_ID，此处作为兜底默认值
  WORKFLOW_APP_ID: '',

  // ── 工作流 biz_params 说明 ────────────────────────────────
  // 以下参数由 callBailianWorkflow 组装后通过 biz_params 传入工作流：
  //   flavors            口味偏好，逗号分隔（如 "酸爽, 清爽"）
  //   base               基酒选择（如 "金酒" 或 "随机"）
  //   output_format      固定为 "json"
  //   custom_requirement（可选）用户自定义额外要求
}
