// test/pages/subscription.test.js — 订阅页测试

const { getMini, bypassLogin, navigateTo, sleep } = require('../helpers')

describe('订阅页 — Free 用户视图', () => {
  beforeAll(async () => {
    await bypassLogin() // Free 用户
    await navigateTo('pages/subscription/subscription')
    await sleep(600)
  })

  test('状态卡可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const card = await page.$('.current-card')
    expect(card).toBeTruthy()
  })

  test('Free 徽章显示', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const badge = await page.$('.badge-free')
    expect(badge).toBeTruthy()
  })

  test('三大亮点 benefit chips 渲染', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const chips = await page.$$('.sub-benefit-item')
    expect(chips.length).toBe(3)
  })

  test('AI 配额进度条可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const bar = await page.$('.ai-quota-bg')
    expect(bar).toBeTruthy()
  })

  test('版本对比表格可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const table = await page.$('.compare-card')
    expect(table).toBeTruthy()
  })

  test('套餐列表渲染（3个套餐）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const plans = await page.$$('.plan-card')
    expect(plans.length).toBe(3)
  })

  test('默认选中季度套餐', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    expect(data.selectedPlan).toBe('quarterly')
  })

  test('点击月度套餐切换选中', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const plans = await page.$$('.plan-card')
    await plans[0].tap()
    await sleep(300)
    const data = await page.data()
    expect(data.selectedPlan).toBe('monthly')
  })

  test('订阅按钮可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const btn = await page.$('.subscribe-btn')
    expect(btn).toBeTruthy()
  })

  test('FAQ 列表渲染（至少2条）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const faqs = await page.$$('.faq-card')
    expect(faqs.length).toBeGreaterThanOrEqual(2)
  })

  test('点击 FAQ 展开答案', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const faqs = await page.$$('.faq-card')
    await faqs[0].tap()
    await sleep(300)
    const data = await page.data()
    expect(data.expandedFaq).toBe(1) // FAQS[0].id = 1
    // 答案元素出现
    const ans = await page.$('.faq-a')
    expect(ans).toBeTruthy()
  })

  test('再次点击 FAQ 折叠答案', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const faqs = await page.$$('.faq-card')
    await faqs[0].tap()
    await sleep(300)
    const data = await page.data()
    expect(data.expandedFaq).toBeNull()
  })
})

describe('订阅页 — Pro 用户视图', () => {
  beforeAll(async () => {
    await bypassLogin({
      plan:          'pro',
      planExpiry:    '2026-12-31',
      planAutoRenew: true,
    }, true)
    await navigateTo('pages/subscription/subscription')
    await sleep(600)
  })

  test('Pro 徽章显示', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const badge = await page.$('.badge-pro')
    expect(badge).toBeTruthy()
  })

  test('到期日期显示', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const expiry = await page.$('.current-expiry')
    expect(expiry).toBeTruthy()
    const text = await expiry.text()
    expect(text).toContain('2026-12-31')
  })

  test('有效期进度条可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const bar = await page.$('.expiry-bar-bg')
    expect(bar).toBeTruthy()
  })

  test('自动续订徽章显示 "续订中"', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const chip = await page.$('.auto-renew-chip')
    const text = await chip.text()
    expect(text).toContain('续订')
  })

  test('管理区可见（自动续订中）', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const manage = await page.$('.manage-card')
    expect(manage).toBeTruthy()
  })

  test('套餐列表在 Pro+续订状态下隐藏', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // isPro=true, isAutoRenew=true, isRenewing=false → plan-list 不可见
    expect(data.isPro).toBe(true)
    expect(data.isAutoRenew).toBe(true)
    expect(data.isRenewing).toBe(false)
    const planList = await page.$('.plan-list')
    expect(planList).toBeNull()
  })

  test('点击"续费/升级套餐"展开套餐列表', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const renewRow = await page.$('.manage-row')
    await renewRow.tap()
    await sleep(400)
    const data = await page.data()
    expect(data.isRenewing).toBe(true)
    // 套餐列表现在应可见
    const planList = await page.$('.plan-list')
    expect(planList).toBeTruthy()
  })

  test('isRenewing 时 Pro 状态卡不变', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const data = await page.data()
    // isPro 不受 isRenewing 影响
    expect(data.isPro).toBe(true)
    const badgePro = await page.$('.badge-pro')
    expect(badgePro).toBeTruthy()
  })

  test('续费模式下"取消"按钮可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const cancelBtn = await page.$('.sub-cancel-renew')
    expect(cancelBtn).toBeTruthy()
  })

  test('点击"取消"收起套餐列表', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const cancelBtn = await page.$('.sub-cancel-renew')
    await cancelBtn.tap()
    await sleep(400)
    const data = await page.data()
    expect(data.isRenewing).toBe(false)
  })
})
