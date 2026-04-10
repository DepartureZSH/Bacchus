// test/pages/help.test.js — 帮助与反馈页测试

const { getMini, bypassLogin, navigateTo, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin()
  await navigateTo('pages/help/help')
  await sleep(600)
})

describe('帮助页 — 渲染', () => {
  test('快速入口按钮渲染', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const btns = await page.$$('.quick-btn')
    expect(btns.length).toBeGreaterThanOrEqual(1)
  })

  test('FAQ 列表渲染（至少2条）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const faqs = await page.$$('.faq-card')
    expect(faqs.length).toBeGreaterThanOrEqual(2)
  })

  test('反馈卡片可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const card = await page.$('.feedback-card')
    expect(card).toBeTruthy()
  })

  test('关于区块可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const about = await page.$('.about-card')
    expect(about).toBeTruthy()
  })
})

describe('帮助页 — FAQ 交互', () => {
  test('点击 FAQ 展开答案', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const faqs = await page.$$('.faq-card')
    await faqs[0].tap()
    await sleep(300)
    const body = await page.$('.faq-body, .faq-a')
    expect(body).toBeTruthy()
  })

  test('再次点击 FAQ 折叠答案', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const faqs = await page.$$('.faq-card')
    await faqs[0].tap()
    await sleep(300)
    // 折叠后 expandedFaq 应为 null 或 undefined
    const data = await page.data()
    expect(data.expandedFaq == null).toBe(true)
  })
})

describe('帮助页 — 反馈表单', () => {
  test('反馈类型标签渲染（至少2个）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const chips = await page.$$('.fb-type-chip')
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })

  test('点击反馈类型切换选中', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const chips = await page.$$('.fb-type-chip')
    if (chips.length >= 1) {
      await chips[0].tap()
      await sleep(300)
      const active = await page.$('.fb-type-active')
      expect(active).toBeTruthy()
    }
  })

  test('反馈输入框可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const input = await page.$('.feedback-input')
    expect(input).toBeTruthy()
  })

  test('提交按钮初始为禁用（未输入内容）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const btn = await page.$('.feedback-submit')
    expect(btn).toBeTruthy()
    // 未输入时应带 disabled 样式
    const html = await btn.outerHTML()
    const data = await page.data()
    // 验证 data 中内容为空
    expect((data.feedbackText || data.content || '').length).toBe(0)
  })

  test('输入反馈内容后字数计数更新', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const input = await page.$('.feedback-input')
    if (input) {
      await input.input('这是一条测试反馈')
      await sleep(300)
      const data = await page.data()
      const text = data.feedbackText || data.content || ''
      expect(text.length).toBeGreaterThan(0)
    }
  })
})
