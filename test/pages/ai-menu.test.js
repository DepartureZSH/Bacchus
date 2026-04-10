// test/pages/ai-menu.test.js — AI运营页测试

const { getMini, bypassLogin, switchTab, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin()
  const mini = await getMini()
  await mini.reLaunch('pages/ai-menu/ai-menu')
  await sleep(800)
})

describe('AI运营页 — 基础渲染', () => {
  test('Tab 切换组件可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // 双 Tab 容器
    const tabs = await page.$$('.tab-item')
    expect(tabs.length).toBeGreaterThanOrEqual(2)
  })

  test('初始 Tab 为 AI酒单', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // activeTab 为 0 或字符串 'menu'
    expect(data.activeTab === 0 || data.activeTab === 'menu').toBeTruthy()
  })
})

describe('AI运营页 — Tab 切换', () => {
  test('切换到 AI营销 Tab', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const tabs = await page.$$('.tab-item')
    if (tabs.length >= 2) {
      await tabs[1].tap()
      await sleep(400)
      const data = await page.data()
      // 验证 activeTab 切换到第二个
      expect(data.activeTab === 1 || data.activeTab === 'mktg').toBeTruthy()
    }
  })

  test('切换回 AI酒单 Tab', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const tabs = await page.$$('.tab-item')
    if (tabs.length >= 1) {
      await tabs[0].tap()
      await sleep(400)
      const data = await page.data()
      expect(data.activeTab === 0 || data.activeTab === 'menu').toBeTruthy()
    }
  })
})

describe('AI运营页 — Free 配额', () => {
  test('Free 用户配额信息可读取', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // aiQuotaLimit 应存在
    expect(data.aiQuotaLimit).toBeDefined()
  })
})
