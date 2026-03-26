// pages/login/login.js
const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    loading: false,
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight })
    // 已有 shopId（缓存登录态）→ 静默刷新后跳首页
    if (app.globalData.isLoggedIn) {
      app.refreshShopInfo()
      wx.switchTab({ url: '/pages/dashboard/dashboard' })
    }
  },

  onWechatLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    wx.showLoading({ title: '登录中…', mask: true })

    app.initShop()
      .then(({ isNew }) => {
        wx.hideLoading()
        this.setData({ loading: false })

        if (isNew) {
          // 新用户：触发数据迁移
          this._migrateLocalData()
        }
        wx.switchTab({ url: '/pages/dashboard/dashboard' })
      })
      .catch(err => {
        wx.hideLoading()
        this.setData({ loading: false })
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        console.error('[login] initShop failed:', err)
      })
  },

  // 一次性迁移本地 wx.storage 数据到云端
  _migrateLocalData() {
    // 检查是否已迁移过
    if (wx.getStorageSync('bacchus_migrated')) return

    const localIngredients = wx.getStorageSync('bacchus_ingredients') || []
    const localLogs        = wx.getStorageSync('bacchus_stock_logs')  || {}

    // 没有本地数据也跳过
    if (!localIngredients.length && !Object.keys(localLogs).length) {
      wx.setStorageSync('bacchus_migrated', true)
      return
    }

    wx.showToast({ title: '正在同步历史数据…', icon: 'loading', duration: 3000 })

    wx.cloud.callFunction({
      name: 'ingredients',
      data: {
        action:  'migrate',
        payload: { ingredients: localIngredients, logs: localLogs },
      },
    }).then(res => {
      const r = res.result || {}
      if (r.success) {
        wx.setStorageSync('bacchus_migrated', true)
        // 迁移完成后清理本地大 key
        wx.removeStorageSync('bacchus_ingredients')
        wx.removeStorageSync('bacchus_stock_logs')
        console.log(`[migration] 完成：新增${r.imported}条，跳过${r.skipped}条，日志${r.logImported}条`)
      }
    }).catch(err => {
      console.error('[migration] 失败，下次登录重试:', err)
    })
  },
})
