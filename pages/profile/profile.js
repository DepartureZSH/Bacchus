// pages/profile/profile.js
const app = getApp()
const DB  = require('../../data/ingredients')

Page({
  data: { shopInfo: {}, unitLabel: '', alertCount: 0, isPro: false },

  onLoad() { this._refresh() },
  onShow()  { this._refresh() },

  _refresh() {
    const s = app.globalData.shopInfo
    const u = app.globalData.unitSettings
    // 先用缓存渲染
    this.setData({
      shopInfo:  s,
      isPro:     s.plan === 'pro' || s.plan === 'Pro',
      unitLabel: `${u.volume} · ${u.weight} · ${u.currency}`,
    })
    // 异步拉库存告警数
    DB.getAll().then(list => {
      const alertCount = list.filter(i => i.status === 'danger' || i.status === 'warn').length
      this.setData({ alertCount })
    }).catch(() => {})
  },

  goInventory()    { wx.switchTab({ url: '/pages/inventory/inventory' }) },
  goAiMenu()       { wx.switchTab({ url: '/pages/ai-menu/ai-menu' }) },
  goMyRecipes()    { wx.switchTab({ url: '/pages/my-recipes/my-recipes' }) },
  goShoppingList() { wx.navigateTo({ url: '/pages/shopping-list/shopping-list' }) },
  goShopInfo()     { wx.navigateTo({ url: '/pages/shop-info/shop-info' }) },
  goUnitSettings() { wx.navigateTo({ url: '/pages/unit-settings/unit-settings' }) },
  goHelp()         { wx.navigateTo({ url: '/pages/help/help' }) },
  goSubscription() { wx.navigateTo({ url: '/pages/subscription/subscription' }) },
  goExport()       { wx.navigateTo({ url: '/pages/export/export' }) },

  onLogout() {
    wx.showModal({
      title: '确认退出', content: '退出后需重新登录',
      confirmText: '退出', confirmColor: '#e05c5c',
      success: (res) => {
        if (res.confirm) {
          app.globalData.isLoggedIn    = false
          app.globalData.shopId        = null
          app._lowStockChecked         = false
          wx.removeStorageSync('shopId')
          wx.removeStorageSync('bacchus_shopInfo')
          wx.reLaunch({ url: '/pages/login/login' })
        }
      }
    })
  },
})
