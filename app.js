// app.js
App({
  globalData: {
    userInfo:    null,
    shopId:      null,      // 云数据库 shops._id，登录后写入
    shopInfo: {
      name:       'Bacchus',
      city:       '',
      address:    '',
      phone:      '',
      plan:       'free',
      planExpiry: null,
    },
    unitSettings: {
      volume:   'ml',
      weight:   'g',
      currency: '¥',
    },
    isLoggedIn: false,
    isOffline:  false,
  },

  onLaunch() {
    // ① 初始化云开发（必须最先执行）
    wx.cloud.init({
      env:       'cloud1-1g8c1a9k69d87e80',   // ← 替换为你的云环境 ID
      traceUser: true,
    })

    // ② 读取本地缓存的 shopId（离线时保持登录态）
    const cachedShopId = wx.getStorageSync('shopId')
    if (cachedShopId) {
      this.globalData.shopId     = cachedShopId
      this.globalData.isLoggedIn = true
    }

    // ③ 读取本地缓存的 shopInfo / unitSettings（离线时使用）
    const cachedShop  = wx.getStorageSync('bacchus_shopInfo')
    const cachedUnits = wx.getStorageSync('bacchus_unitSettings')
    if (cachedShop)  Object.assign(this.globalData.shopInfo,     cachedShop)
    if (cachedUnits) Object.assign(this.globalData.unitSettings, cachedUnits)

// ④ 监听网络状态，离线时展示 banner，恢复时自动同步
wx.onNetworkStatusChange(({ isConnected }) => {
  const wasOffline = this.globalData.isOffline
  this.globalData.isOffline = !isConnected
  if (!isConnected) {
    // 变为离线
    wx.showToast({ title: '已进入离线模式', icon: 'none', duration: 2000 })
    this._showOfflineBanner(true)
  } else if (wasOffline) {
    // 从离线恢复
    this._showOfflineBanner(false)
    wx.showToast({ title: '网络已恢复 ✓', icon: 'success', duration: 1500 })
    // 延迟 1 秒，等页面稳定后刷新云端数据
    setTimeout(() => { this.refreshShopInfo() }, 1000)
  }
})
wx.getNetworkType({
  success: ({ networkType }) => {
    this.globalData.isOffline = (networkType === 'none')
    if (networkType === 'none') this._showOfflineBanner(true)
  }
})
},

// 登录建档（由 login 页面调用）
initShop(shopName) {
return wx.cloud.callFunction({
  name: 'shops',
  data: { action: 'init', payload: { shopName: shopName || '' } },
}).then(res => {
  const { success, shopId, shopInfo, isNew } = res.result || {}
  if (!success) throw new Error('init failed')

  this.globalData.shopId     = shopId
  this.globalData.isLoggedIn = true
  this.globalData.shopInfo   = { ...this.globalData.shopInfo, ...shopInfo, id: shopId }
  if (shopInfo.unitSettings) {
    this.globalData.unitSettings = shopInfo.unitSettings
    wx.setStorageSync('bacchus_unitSettings', shopInfo.unitSettings)
  }
  wx.setStorageSync('shopId', shopId)
  wx.setStorageSync('bacchus_shopInfo', this.globalData.shopInfo)
  return { success: true, isNew }
})
},

// 刷新云端店铺信息（静默）
refreshShopInfo() {
if (!this.globalData.shopId || this.globalData.isOffline) return
wx.cloud.callFunction({ name:'shops', data:{ action:'get' } })
  .then(res => {
    if (res.result && res.result.success) {
      const s = res.result.shopInfo
      this.globalData.shopInfo = { ...this.globalData.shopInfo, ...s, id: s._id }
      if (s.unitSettings) {
        this.globalData.unitSettings = s.unitSettings
        wx.setStorageSync('bacchus_unitSettings', s.unitSettings)
      }
      wx.setStorageSync('bacchus_shopInfo', this.globalData.shopInfo)
    }
  }).catch(() => {})
},

// 低库存提醒
checkLowStock() {
if (this._lowStockChecked) return
this._lowStockChecked = true
const DB = require('./data/ingredients')
DB.getAll().then(list => {
  const alerts = list.filter(i => i.status === 'danger' || i.status === 'warn')
  if (!alerts.length) return
  const dl = alerts.filter(i => i.status === 'danger')
  const wl = alerts.filter(i => i.status === 'warn')
  let content = ''
  if (dl.length) content += `🔴 告急（${dl.length}项）：${dl.map(i=>i.name).join('、')}\n`
  if (wl.length) content += `🟡 偏低（${wl.length}项）：${wl.map(i=>i.name).join('、')}`
  wx.showModal({
    title: `⚠ 库存预警（${alerts.length}项）`,
    content: content.trim(),
    confirmText: '去采购', cancelText: '稍后处理',
    success(res) { if (res.confirm) wx.navigateTo({ url: '/pages/ai-menu/ai-menu?tab=purchase' }) }
  })
}).catch(() => {})
},

// 保存店铺信息（本地+云端双写）
saveShopInfo(info) {
this.globalData.shopInfo = { ...this.globalData.shopInfo, ...info }
wx.setStorageSync('bacchus_shopInfo', this.globalData.shopInfo)
if (!this.globalData.isOffline) {
  wx.cloud.callFunction({ name:'shops', data:{ action:'update', payload:info } }).catch(()=>{})
}
},

// ── 离线 banner：向当前页面通知离线状态 ────────────────
_showOfflineBanner(isOffline) {
// 通过全局事件让各页面自行更新 isOffline 状态
this.globalData.isOffline = isOffline
// 各页面在 onShow 时读取 app.globalData.isOffline 即可
},

// 保存单位设置
saveUnitSettings(settings) {
this.globalData.unitSettings = { ...this.globalData.unitSettings, ...settings }
wx.setStorageSync('bacchus_unitSettings', this.globalData.unitSettings)
if (!this.globalData.isOffline) {
  wx.cloud.callFunction({ name:'shops', data:{ action:'updateUnits', payload:settings } }).catch(()=>{})
}
},
})
