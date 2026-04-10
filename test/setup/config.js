// test/setup/config.js — 全局配置常量

const path = require('path')

module.exports = {
  // 微信开发者工具 CLI 路径（Windows）
  devToolsPath: 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',

  // 小程序项目根目录
  projectPath: path.resolve(__dirname, '../../'),

  // wsEndpoint 缓存文件（global-setup 写，各 test 文件读）
  wsEndpointFile: path.resolve(__dirname, '../.ws-endpoint.json'),

  // AppID
  appId: 'wx65c239ea2b8a0f8a',

  // 模拟登录用的 globalData
  mockShopInfo: {
    name:       '测试酒吧',
    city:       '上海',
    address:    '测试路 1 号',
    phone:      '13800138000',
    plan:       'free',
    planExpiry: null,
    planAutoRenew: false,
    alertCount: 2,
  },

  mockShopInfoPro: {
    name:       '测试酒吧 Pro',
    city:       '上海',
    address:    '测试路 1 号',
    phone:      '13800138000',
    plan:       'pro',
    planExpiry: '2026-12-31',
    planAutoRenew: true,
    alertCount: 0,
  },

  mockUnitSettings: { volume: 'ml', weight: 'g', currency: '¥' },
}
