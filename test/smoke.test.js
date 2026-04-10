// test/smoke.test.js — 冒烟测试：验证各 Tab 页面能正常渲染

const { getMini, bypassLogin, switchTab, navigateTo, sleep } = require('./helpers')

beforeAll(async () => {
  await bypassLogin()
  // 从登录页跳到首页
  const mini = await getMini()
  await mini.reLaunch('pages/dashboard/dashboard')
  await sleep(800)
})

describe('冒烟测试 — tabBar 五页', () => {
  test('首页 (dashboard) 能渲染', async () => {
    const page = await switchTab('pages/dashboard/dashboard')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('dashboard')
  })

  test('库存页 (inventory) 能渲染', async () => {
    await switchTab('pages/inventory/inventory')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('inventory')
  })

  test('AI运营页 (ai-menu) 能渲染', async () => {
    await switchTab('pages/ai-menu/ai-menu')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('ai-menu')
  })

  test('配方页 (my-recipes) 能渲染', async () => {
    await switchTab('pages/my-recipes/my-recipes')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('my-recipes')
  })

  test('我的页 (profile) 能渲染', async () => {
    await switchTab('pages/profile/profile')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('profile')
  })
})

describe('冒烟测试 — 设置类子页', () => {
  test('subscription 页能渲染', async () => {
    await navigateTo('pages/subscription/subscription')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('subscription')
  })

  test('shop-info 页能渲染', async () => {
    await navigateTo('pages/shop-info/shop-info')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('shop-info')
  })

  test('unit-settings 页能渲染', async () => {
    await navigateTo('pages/unit-settings/unit-settings')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('unit-settings')
  })

  test('export 页能渲染', async () => {
    await navigateTo('pages/export/export')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('export')
  })

  test('help 页能渲染', async () => {
    await navigateTo('pages/help/help')
    await sleep(500)
    const mini = await getMini()
    const cur  = await mini.currentPage()
    expect(cur.path).toContain('help')
  })
})
