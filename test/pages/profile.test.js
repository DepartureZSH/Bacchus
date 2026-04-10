// test/pages/profile.test.js — 我的页测试

const { getMini, bypassLogin, switchTab, sleep } = require('../helpers')

beforeAll(async () => {
  await bypassLogin({ alertCount: 3 })
  const mini = await getMini()
  await mini.reLaunch('pages/profile/profile')
  await sleep(800)
})

describe('我的页 — Free 用户', () => {
  test('头部 Hero 卡片可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const hero = await page.$('.pf-hero')
    expect(hero).toBeTruthy()
  })

  test('店铺名称显示正确', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const hero = await page.$('.pf-hero')
    const html = await hero.outerHTML()
    expect(html).toContain('测试酒吧')
  })

  test('预警条在 alertCount > 0 时可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const strip = await page.$('.pf-alert-strip')
    expect(strip).toBeTruthy()
  })

  test('Free 用户显示升级 CTA', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const cta = await page.$('.pf-upgrade-cta')
    expect(cta).toBeTruthy()
  })

  test('退出登录按钮可见', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const logoutBtn = await page.$('.pf-logout-btn')
    expect(logoutBtn).toBeTruthy()
  })

  test('主菜单行至少3项', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const rows = await page.$$('.pf-row')
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })
})

describe('我的页 — Pro 用户', () => {
  beforeAll(async () => {
    await bypassLogin({}, true) // pro=true
    const mini = await getMini()
    await mini.reLaunch('pages/profile/profile')
    await sleep(600)
  })

  test('Pro 用户显示 Pro 徽章', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const badge = await page.$('.pf-pro-badge')
    expect(badge).toBeTruthy()
  })

  test('Pro 用户不显示升级 CTA', async () => {
    const mini = await getMini()
    const page = await mini.currentPage()
    const cta = await page.$('.pf-upgrade-cta')
    expect(cta).toBeNull()
  })
})
