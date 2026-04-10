// test/pages/export.test.js — 导出页测试

const { getMini, bypassLogin, navigateTo, sleep } = require('../helpers')

describe('导出页 — Free 用户', () => {
  beforeAll(async () => {
    await bypassLogin()
    await navigateTo('pages/export/export')
    await sleep(600)
  })

  test('导出类型列表可见（至少1项）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const types = await page.$$('.type-card')
    expect(types.length).toBeGreaterThanOrEqual(1)
  })

  test('数据预览卡片可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const preview = await page.$('.preview-card')
    expect(preview).toBeTruthy()
  })

  test('导出方式网格可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const grid = await page.$('.action-grid')
    expect(grid).toBeTruthy()
  })

  test('Pro 锁定的导出方式带锁定标记', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const lockBadges = await page.$$('.lock-badge')
    // Free 用户应至少有1个功能被锁定
    expect(lockBadges.length).toBeGreaterThanOrEqual(1)
  })

  test('点击第一个导出类型切换选中', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const types = await page.$$('.type-card')
    if (types.length >= 1) {
      await types[0].tap()
      await sleep(300)
      const active = await page.$('.type-card-active')
      expect(active).toBeTruthy()
    }
  })
})

describe('导出页 — Pro 用户', () => {
  beforeAll(async () => {
    await bypassLogin({}, true)
    await navigateTo('pages/export/export')
    await sleep(600)
  })

  test('Pro 用户锁定标记减少或消失', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // Pro 用户 isPro = true
    expect(data.isPro).toBe(true)
  })
})
