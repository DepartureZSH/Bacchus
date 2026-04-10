// test/pages/my-recipes.test.js — 配方页测试

const { getMini, bypassLogin, switchTab, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin()
  const mini = await getMini()
  await mini.reLaunch('pages/my-recipes/my-recipes')
  await sleep(800)
})

describe('配方页 — 基础渲染', () => {
  test('四 Tab 标签渲染', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const tabs = await page.$$('.tab-item')
    expect(tabs.length).toBeGreaterThanOrEqual(4)
  })

  test('默认 Tab 为发现', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // 默认显示发现 tab（activeTab = 'discover' 或 0）
    expect(
      data.activeTab === 'discover' || data.activeTab === 0
    ).toBeTruthy()
  })
})

describe('配方页 — Tab 切换', () => {
  test('切换到"我的"Tab', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const tabs = await page.$$('.tab-item')
    // 找"我的"tab，按顺序第2个（发现/我的/收藏/合集）
    if (tabs.length >= 2) {
      await tabs[1].tap()
      await sleep(400)
      const data = await page.data()
      expect(
        data.activeTab === 'mine' || data.activeTab === 1
      ).toBeTruthy()
    }
  })

  test('切换到"合集"Tab', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const tabs = await page.$$('.tab-item')
    if (tabs.length >= 4) {
      await tabs[3].tap()
      await sleep(400)
      const data = await page.data()
      expect(
        data.activeTab === 'collection' || data.activeTab === 3
      ).toBeTruthy()
    }
  })

  test('切回"发现"Tab', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const tabs = await page.$$('.tab-item')
    if (tabs.length >= 1) {
      await tabs[0].tap()
      await sleep(400)
      const data = await page.data()
      expect(
        data.activeTab === 'discover' || data.activeTab === 0
      ).toBeTruthy()
    }
  })
})
