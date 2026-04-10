// test/helpers/index.js — 共享测试工具函数

const automator = require('miniprogram-automator')
const fs        = require('fs')
const cfg       = require('../setup/config')

// ── 单例 miniProgram 实例 ──────────────────────────────────────
let _mini = null

/**
 * 获取（或连接）miniProgram 实例。
 * 必须在 beforeAll / beforeEach 中调用。
 */
async function getMini() {
  if (_mini) return _mini
  const { wsEndpoint } = JSON.parse(fs.readFileSync(cfg.wsEndpointFile, 'utf-8'))
  _mini = await automator.connect({ wsEndpoint })
  return _mini
}

/**
 * 绕过登录：直接往 globalData 注入已登录状态。
 * @param {object} overrides  可覆盖 shopInfo 中的字段
 * @param {boolean} pro       是否以 Pro 用户身份登录
 */
async function bypassLogin(overrides = {}, pro = false) {
  const mini = await getMini()
  const shopInfo = Object.assign(
    {},
    pro ? cfg.mockShopInfoPro : cfg.mockShopInfo,
    overrides
  )
  await mini.evaluate((shopInfo, unitSettings) => {
    const app = getApp()
    app.globalData.isLoggedIn    = true
    app.globalData.shopId        = 'test-shop-001'
    app.globalData.shopInfo      = shopInfo
    app.globalData.unitSettings  = unitSettings
    app.globalData.isOffline     = false
  }, shopInfo, cfg.mockUnitSettings)
  return mini
}

/**
 * 导航到指定页面（非 tabBar 页）。
 * @param {string} url  如 'pages/subscription/subscription'
 */
async function navigateTo(url) {
  const mini = await getMini()
  const page = await mini.navigateTo(url)
  // 等待页面渲染
  await mini.waitFor(300)
  return page
}

/**
 * 切换 tabBar 标签。
 * @param {string} url  如 'pages/inventory/inventory'
 */
async function switchTab(url) {
  const mini = await getMini()
  const page = await mini.switchTab(url)
  await mini.waitFor(300)
  return page
}

/**
 * 获取当前页面。
 */
async function getCurrentPage() {
  const mini = await getMini()
  return mini.currentPage()
}

/**
 * 等待某元素出现（轮询）。
 * @param {object} page  miniprogram-automator Page 对象
 * @param {string} selector  WXML 选择器
 * @param {number} timeout   超时 ms
 */
async function waitForElement(page, selector, timeout = 5000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const el = await page.$(selector)
    if (el) return el
    await sleep(200)
  }
  throw new Error(`waitForElement: "${selector}" 超时 ${timeout}ms 未出现`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  getMini,
  bypassLogin,
  navigateTo,
  switchTab,
  getCurrentPage,
  waitForElement,
  sleep,
}
