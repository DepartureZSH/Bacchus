// pages/shop-info/shop-info.js
const app = getApp()

Page({
  data: { form: {}, shopInfo: {}, errorMsg: '' },

  onLoad() {
    const s = app.globalData.shopInfo
    this.setData({
      shopInfo: s,
      form: { name: s.name, city: s.city, address: s.address, phone: s.phone }
    })
  },

  onInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value, errorMsg: '' })
  },

  onSave() {
    if (!this.data.form.name.trim()) {
      this.setData({ errorMsg: '店铺名称不能为空' }); return
    }
    app.saveShopInfo(this.data.form)
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 800)
  },

  onUpgrade() {
    wx.showToast({ title: '订阅管理即将上线 ✦', icon: 'none', duration: 2000 })
  }
})
