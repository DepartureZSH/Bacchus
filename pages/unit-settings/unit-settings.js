// pages/unit-settings/unit-settings.js
const app = getApp()

Page({
  data: {
    settings: {},
    volumeOpts: [
      { val:'ml',  label:'毫升 (ml)',  desc:'国际通用，鸡尾酒行业标准' },
      { val:'oz',  label:'盎司 (oz)',  desc:'1 oz ≈ 29.57 ml，英美常用' },
      { val:'cl',  label:'厘升 (cl)',  desc:'1 cl = 10 ml，欧洲常用' },
    ],
    weightOpts: [
      { val:'g',  label:'克 (g)',   desc:'国际通用' },
      { val:'oz', label:'盎司 (oz)', desc:'1 oz ≈ 28.35 g' },
    ],
    currencyOpts: [
      { val:'¥', label:'人民币 (¥)', desc:'CNY，中国大陆' },
      { val:'$', label:'美元 ($)',   desc:'USD' },
      { val:'€', label:'欧元 (€)',   desc:'EUR' },
      { val:'HK$', label:'港元 (HK$)', desc:'HKD，香港' },
    ],
  },

  onLoad() {
    this.setData({ settings: { ...app.globalData.unitSettings } })
  },

  onSelect(e) {
    const { group, val } = e.currentTarget.dataset
    const newSettings = { ...this.data.settings, [group]: val }
    this.setData({ settings: newSettings })
    app.saveUnitSettings(newSettings)
    wx.showToast({ title: '已保存', icon: 'success', duration: 800 })
  },
})
