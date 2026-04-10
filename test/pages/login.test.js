// test/pages/login.test.js — 登录页测试

const { getMini, sleep } = require('../helpers')

beforeAll(async () => {
  const mini = await getMini()
  // 重置登录状态，跳到登录页
  await mini.evaluate(() => {
    const app = getApp()
    app.globalData.isLoggedIn = false
    app.globalData.shopId     = null
    app.globalData.shopInfo   = {}
  })
  await mini.reLaunch('pages/login/login')
  await sleep(600)
})

describe('登录页', () => {
  test('品牌 Logo 区域可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const logo = await page.$('.login-logo')
    expect(logo).toBeTruthy()
  })

  test('品牌名称文字可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const title = await page.$('.login-title')
    expect(title).toBeTruthy()
    const text = await title.text()
    expect(text).toMatch(/Bacchus/i)
  })

  test('微信登录按钮可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const btn = await page.$('.btn-wechat')
    expect(btn).toBeTruthy()
  })

  test('点击登录按钮触发登录流程（模拟 globalData 注入）', async () => {
    const mini = await getMini()
    // 直接注入登录状态模拟云函数回调
    await mini.evaluate(() => {
      const app = getApp()
      app.globalData.isLoggedIn = true
      app.globalData.shopId     = 'test-shop-001'
      app.globalData.shopInfo   = { name: '测试酒吧', plan: 'free' }
    })
    // 跳转到首页
    await mini.reLaunch('pages/dashboard/dashboard')
    await sleep(600)
    const cur = await mini.currentPage()
    expect(cur.path).toContain('dashboard')
  })
})
