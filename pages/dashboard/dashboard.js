// pages/dashboard/dashboard.js
const app = getApp()
const DB  = require('../../data/ingredients')

function _callAnalytics(data) {
  return wx.cloud.callFunction({ name: 'analytics', data }).then(r => r.result || {})
}
function _todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

Page({
  data: {
    shopInfo:          {},
    alertIngredients:  [],
    // 指标数据
    todayRevenue:      '--',
    todayTrend:        null,
    weekRevenue:       '--',
    weekProfit:        '--',
    weekMargin:        0,
    recentSales:       [],
    dataLoading:       false,
    // 记录弹窗
    showRecordModal:   false,
    recordDate:        '',      // 正在编辑的日期
    recordIsEdit:      false,   // true = 编辑已有记录
    recordForm:        { revenue: '', cups: '', note: '' },
    recordLoading:     false,
  },

  onLoad() {
    this.setData({ shopInfo: app.globalData.shopInfo || {} })
    this._loadAlerts()
    this._loadDashData()
  },

  onShow() {
    this.setData({ shopInfo: app.globalData.shopInfo || {} })
    this._loadAlerts()
    this._loadDashData()
    app.checkLowStock()
  },

  // ── 库存预警 ────────────────────────────────────────────
  _loadAlerts() {
    DB.getAll().then(list => {
      this.setData({
        alertIngredients: list
          .filter(i => i.status === 'danger' || i.status === 'warn')
          .map(i => ({ ...i, statusText: i.status === 'danger' ? '告急' : '偏低' })),
      })
    }).catch(() => {})
  },

  // ── 经营数据 ────────────────────────────────────────────
  _loadDashData() {
    this.setData({ dataLoading: true })
    _callAnalytics({ action: 'dashSummary' }).then(r => {
      if (!r.success) { this.setData({ dataLoading: false }); return }
      this.setData({
        dataLoading:    false,
        todayRevenue:   r.todayRec ? r.todayRec.revenue : '--',
        todayTrend:     r.todayTrend || null,
        weekRevenue:    r.weekRevenue != null ? r.weekRevenue : 0,
        weekProfit:     r.weekProfit  != null ? r.weekProfit  : '--',
        weekMargin:     r.weekMargin  != null ? r.weekMargin  : 0,
        recentSales:    r.recentSales || [],
      })
    }).catch(() => this.setData({ dataLoading: false }))
  },

  // ── 记录弹窗：打开（新建今日 / 编辑指定日期）───────────
  onTapTodayCard() {
    const today = _todayStr()
    const exist = this.data.recentSales.find(r => r.date === today)
    this.setData({
      showRecordModal: true,
      recordDate:      today,
      recordIsEdit:    !!exist,
      recordForm: {
        revenue: exist ? String(exist.revenue) : '',
        cups:    exist ? String(exist.cups || '') : '',
        note:    exist ? (exist.note || '') : '',
      },
    })
  },

  onEditSale(e) {
    const date = e.currentTarget.dataset.date
    const rec  = this.data.recentSales.find(r => r.date === date)
    if (!rec) return
    this.setData({
      showRecordModal: true,
      recordDate:      date,
      recordIsEdit:    true,
      recordForm: {
        revenue: String(rec.revenue),
        cups:    String(rec.cups || ''),
        note:    rec.note || '',
      },
    })
  },

  onCloseModal() { this.setData({ showRecordModal: false }) },

  onRecordInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`recordForm.${key}`]: e.detail.value })
  },

  onRecordSubmit() {
    const { recordForm, recordDate, recordLoading } = this.data
    if (recordLoading) return
    const revenue = Number(recordForm.revenue)
    if (!revenue || revenue <= 0) {
      wx.showToast({ title: '请输入营业额', icon: 'none' }); return
    }
    this.setData({ recordLoading: true })
    _callAnalytics({
      action:  'saleAdd',
      date:    recordDate,
      revenue,
      cups:    Number(recordForm.cups) || 0,
      note:    recordForm.note || '',
    }).then(r => {
      this.setData({ recordLoading: false })
      if (r.success) {
        this.setData({ showRecordModal: false })
        wx.showToast({ title: '已保存 ✓', icon: 'success' })
        this._loadDashData()
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ recordLoading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    })
  },

  onDeleteSale(e) {
    const date = e.currentTarget.dataset.date
    wx.showModal({
      title: '删除记录', content: `确定删除 ${date} 的营业记录？`,
      confirmText: '删除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        _callAnalytics({ action: 'saleDelete', date }).then(r => {
          if (r.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this._loadDashData()
          }
        })
      },
    })
  },

  // ── 导航 ────────────────────────────────────────────────
  goInventory()    { wx.switchTab({ url: '/pages/inventory/inventory' }) },
  goAiMenu()       { wx.switchTab({ url: '/pages/ai-menu/ai-menu' }) },
  goMyRecipes()    { wx.switchTab({ url: '/pages/my-recipes/my-recipes' }) },
  goProfile()      { wx.navigateTo({ url: '/pages/profile/profile' }) },
  goShoppingList() { wx.navigateTo({ url: '/pages/shopping-list/shopping-list' }) },
  goAnalytics()    { wx.navigateTo({ url: '/pages/analytics/analytics' }) },
  goSalesRecords() { wx.navigateTo({ url: '/pages/sales-records/sales-records' }) },
})
