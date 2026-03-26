// pages/inventory-detail/inventory-detail.js
const DB = require('../../data/ingredients')
const { getStockPct, STATUS_TEXT } = require('../../utils/helper')

Page({
  data: {
    ing:        {},
    logs:       [],
    showModal:  false,
    modalMode:  'in',
    modalAmount: 100,
    loading:    false,
  },

  onLoad(query) {
    // 云数据库 _id 是字符串，不再转 Number
    this._id = query.id
    this._render()
  },

  onShow() {
    if (this._id) this._render()
  },

  _render() {
    this.setData({ loading: true })
    DB.getById(this._id).then(raw => {
      if (!raw) { this.setData({ loading: false }); return }
      const ing = {
        ...raw,
        id:         raw._id || raw.id,
        stockPct:   getStockPct(raw.stock, raw.threshold),
        stockValue: (raw.stock * raw.costPerUnit).toFixed(0),
        statusText: STATUS_TEXT[raw.status] || raw.status,
      }
      wx.setNavigationBarTitle({ title: ing.name })
      // 日志已在 getById 中一并返回（云函数 get action 合并查询）
      const logs = raw.logs || []
      this.setData({ ing, logs, loading: false })
    }).catch(() => this.setData({ loading: false }))
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/ingredient-form/ingredient-form?id=${this._id}` })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: `删除"${this.data.ing.name}"？此操作不可撤销`,
      confirmText: '删除',
      confirmColor: '#e05c5c',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中…', mask: true })
          DB.deleteIngredient(this._id).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 800)
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  onOpenAdjust(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ showModal: true, modalMode: mode, modalAmount: mode === 'in' ? 100 : 50 })
  },
  onCloseModal() { this.setData({ showModal: false }) },
  stopProp() {},

  onAmountStep(e) {
    const next = Math.max(1, this.data.modalAmount + Number(e.currentTarget.dataset.delta))
    this.setData({ modalAmount: next })
  },
  onAmountSet(e) {
    this.setData({ modalAmount: Number(e.currentTarget.dataset.v) })
  },

  onConfirmAdjust() {
    const { modalMode, modalAmount } = this.data
    const delta  = modalMode === 'in' ? modalAmount : -modalAmount
    const reason = modalMode === 'in' ? '手动入库' : '手动出库'

    wx.showLoading({ title: `${reason}中…`, mask: true })

    DB.adjustStock(this._id, delta, reason).then(updated => {
      wx.hideLoading()
      this.setData({ showModal: false })
      wx.showToast({
        title: `${reason}成功 ${delta > 0 ? '+' : ''}${delta}${updated.unit}`,
        icon: 'success', duration: 1600,
      })
      // 重新渲染（服务端已更新，强制刷新）
      setTimeout(() => this._render(), 300)
    }).catch(err => {
      wx.hideLoading()
      const msg = err.code === 'insufficient_stock'
        ? `库存不足，当前仅剩 ${err.current} ${err.unit}`
        : '操作失败，请重试'
      wx.showToast({ title: msg, icon: 'none', duration: 2500 })
    })
  },
})
