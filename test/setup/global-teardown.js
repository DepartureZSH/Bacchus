// test/setup/global-teardown.js — 关闭开发者工具，清理临时文件

const fs  = require('fs')
const cfg = require('./config')

module.exports = async function () {
  console.log('\n[global-teardown] 关闭微信开发者工具...')

  if (global.__MINI_PROGRAM__) {
    try {
      await global.__MINI_PROGRAM__.close()
    } catch (_) {}
  }

  // 清理 wsEndpoint 文件
  if (fs.existsSync(cfg.wsEndpointFile)) {
    fs.unlinkSync(cfg.wsEndpointFile)
  }

  console.log('[global-teardown] 已关闭。')
}
