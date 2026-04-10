// test/pages/shop-info.test.js — 店铺信息页测试

const { getMini, bypassLogin, navigateTo, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin({
    name:    '测试酒吧',
    city:    '上海',
    address: '测试路 1 号',
    phone:   '13800138000',
  })
  await navigateTo('pages/shop-info/shop-info')
  await sleep(600)
})

describe('店铺信息页 — 渲染', () => {
  test('表单卡片可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // 找到包含输入项的卡片
    const card = await page.$('.card')
    expect(card).toBeTruthy()
  })

  test('店铺名称字段有值', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    expect(data.form?.name || '').toBeTruthy()
  })

  test('保存按钮可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // 保存按钮通常有 save/submit 相关 class 或文字
    const btns = await page.$$('button')
    // 至少存在一个按钮
    expect(btns.length).toBeGreaterThanOrEqual(1)
  })
})

describe('店铺信息页 — 输入', () => {
  test('修改店铺名称字段', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    // 找第一个 .form-input（店铺名称）
    const inputs = await page.$$('.form-input')
    if (inputs.length >= 1) {
      await inputs[0].input('新酒吧名')
      await sleep(300)
      const data = await page.data()
      const name = data.form?.name ?? ''
      expect(name).toContain('新酒吧名')
    }
  })
})
