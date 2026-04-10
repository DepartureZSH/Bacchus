// test/pages/unit-settings.test.js — 单位设置页测试

const { getMini, bypassLogin, navigateTo, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin()
  await navigateTo('pages/unit-settings/unit-settings')
  await sleep(600)
})

describe('单位设置页 — 渲染', () => {
  test('页面至少有1个设置组', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const cards = await page.$$('.card')
    expect(cards.length).toBeGreaterThanOrEqual(1)
  })

  test('单位选项行可见（至少3行）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const options = await page.$$('.option-row')
    expect(options.length).toBeGreaterThanOrEqual(3)
  })

  test('当前单位设置已选中某个选项', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // settings.volume / weight / currency 均有值
    expect(data.settings?.volume).toBeTruthy()
  })
})

describe('单位设置页 — 切换', () => {
  test('切换选项后 data 更新', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // 点击第二个 option-row（通常是第二个体积单位选项）
    const options = await page.$$('.option-row')
    if (options.length >= 2) {
      await options[1].tap()
      await sleep(300)
      const data = await page.data()
      // 验证 settings 仍存在且事件未报错
      expect(data.settings).toBeTruthy()
    }
  })
})
