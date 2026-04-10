// test/setup/global-setup.js — 启动开发者工具，写入 wsEndpoint

const automator = require('miniprogram-automator')
const fs        = require('fs')
const cfg       = require('./config')

module.exports = async function () {
  console.log('\n[global-setup] 启动微信开发者工具...')

  const miniProgram = await automator.launch({
    projectPath:  cfg.projectPath,
    devToolsPath: cfg.devToolsPath,
    // 关闭真实网络请求，减少云函数干扰
    // 若需要真实云数据可注释掉以下两行
    mockNetworkRules: [],
  })

  // 存储 wsEndpoint 以供各测试文件 connect()
  const wsEndpoint = miniProgram.wsEndpoint
  fs.writeFileSync(
    cfg.wsEndpointFile,
    JSON.stringify({ wsEndpoint }),
    'utf-8'
  )

  // 挂到 global，以便 global-teardown 关闭
  global.__MINI_PROGRAM__ = miniProgram

  console.log(`[global-setup] 已启动，wsEndpoint: ${wsEndpoint}`)
}
