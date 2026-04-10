// test/pages/dashboard.test.js — 首页测试

const { getMini, bypassLogin, switchTab, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin({ alertCount: 2 })
  const mini = await getMini()
  await mini.reLaunch('pages/dashboard/dashboard')
  await sleep(800)
})

describe('首页 — 基础渲染', () => {
  test('店铺横幅区域可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const el = await page.$('.shop-banner')
    expect(el).toBeTruthy()
  })

  test('店铺名称显示正确', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // 店铺名在 banner 内
    const banner = await page.$('.shop-banner')
    expect(banner).toBeTruthy()
    const html = await banner.outerHTML()
    expect(html).toContain('测试酒吧')
  })

  test('指标卡片渲染（至少1张）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const cards = await page.$$('.metric-card')
    expect(cards.length).toBeGreaterThanOrEqual(1)
  })

  test('快捷入口网格可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const grid = await page.$('.quick-grid')
    expect(grid).toBeTruthy()
  })

  test('快捷入口至少4个', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const items = await page.$$('.quick-item')
    expect(items.length).toBeGreaterThanOrEqual(4)
  })
})

describe('首页 — 预警条', () => {
  test('alertCount > 0 时预警卡可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // alertCount=2 注入后预警卡应可见
    const alertCard = await page.$('.alert-card')
    expect(alertCard).toBeTruthy()
  })
})

describe('首页 — tabBar 切换', () => {
  test('切换到库存 tab 成功', async () => {
    const mini = await getMini()
    await switchTab('pages/inventory/inventory')
    await sleep(300)
    const cur = await mini.currentPage()
    expect(cur.path).toContain('inventory')
  })

  test('切回首页 tab 成功', async () => {
    const mini = await getMini()
    await switchTab('pages/dashboard/dashboard')
    await sleep(300)
    const cur = await mini.currentPage()
    expect(cur.path).toContain('dashboard')
  })
})
