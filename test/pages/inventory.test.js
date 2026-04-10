// test/pages/inventory.test.js — 库存页测试

const { getMini, bypassLogin, switchTab, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin()
  const mini = await getMini()
  await mini.reLaunch('pages/inventory/inventory')
  await sleep(800)
})

describe('库存页 — 基础渲染', () => {
  test('搜索栏可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const bar = await page.$('.inv-search-bar')
    expect(bar).toBeTruthy()
  })

  test('搜索输入框存在', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const input = await page.$('.inv-search-input')
    expect(input).toBeTruthy()
  })

  test('筛选标签渲染（至少1个）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const chips = await page.$$('.filter-chip')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  test('库存统计区域可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const stats = await page.$('.inv-stats')
    expect(stats).toBeTruthy()
  })

  test('悬浮添加按钮可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const fab = await page.$('.fab')
    expect(fab).toBeTruthy()
  })
})

describe('库存页 — 搜索交互', () => {
  test('搜索框输入后内容可读取', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const input = await page.$('.inv-search-input')
    await input.input('杜松子酒')
    await sleep(300)
    // 验证搜索词已进入 data
    const data = await page.data()
    expect(data.keyword).toBe('杜松子酒')
  })

  test('清空搜索词', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const input = await page.$('.inv-search-input')
    await input.input('')
    await sleep(300)
    const data = await page.data()
    expect(data.keyword).toBe('')
  })
})

describe('库存页 — 筛选', () => {
  test('点击筛选标签切换选中状态', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const chips = await page.$$('.filter-chip')
    if (chips.length > 1) {
      await chips[1].tap()
      await sleep(300)
      // 验证第二个标签带上 active class
      const chips2 = await page.$$('.filter-chip')
      const html   = await chips2[1].outerHTML()
      expect(html).toContain('filter-chip-active')
    }
  })
})
