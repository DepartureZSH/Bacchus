// pages/shopping-list/shopping-list.js
const db  = wx.cloud.database()
const col = db.collection('shopping_list')

Page({
  data: {
    items:         [],
    totalCost:     '0',
    eligibleCount: 0,
    stockingAll:   false,
    loading:       false,
  },

  onShow() { this._refresh() },

  _refresh() {
    this.setData({ loading: true })
    col.orderBy('addedAt', 'desc').get()
      .then(res => {
        this._setItems(res.data || [])
        this.setData({ loading: false })
      })
      .catch(() => this.setData({ loading: false }))
  },

  _setItems(items) {
    const totalCost     = items.reduce((s, i) => s + Number(i.estimateCost || 0), 0)
    const eligibleCount = items.filter(i => i.inInventory && !i.stockedIn && i.ingredientId).length
    this.setData({ items, totalCost: totalCost.toFixed(0), eligibleCount })
  },

  // ── 数量调整 ─────────────────────────────────────────────
  onAdjust(e) {
    const { id, delta } = e.currentTarget.dataset
    const items = this.data.items.map(i => {
      if (i._id !== id) return i
      const newQty = Math.max(1, i.suggestQty + Number(delta))
      return { ...i, suggestQty: newQty, estimateCost: (newQty * i.costPerUnit).toFixed(0) }
    })
    const updated = items.find(i => i._id === id)
    col.doc(id).update({ data: { suggestQty: updated.suggestQty, estimateCost: updated.estimateCost, updatedAt: Date.now() } })
      .catch(() => {})
    this._setItems(items)
  },

  // ── 移除单项 ────────────────────────────────────────────
  onRemove(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '从清单移除', content: '确定移除该采购项？',
      confirmText: '移除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        col.doc(id).remove()
          .then(() => this._setItems(this.data.items.filter(i => i._id !== id)))
          .catch(() => wx.showToast({ title: '移除失败', icon: 'none' }))
      },
    })
  },

  // ── 清除已入库 ───────────────────────────────────────────
  onClearDone() {
    const done = this.data.items.filter(i => i.stockedIn)
    if (!done.length) { wx.showToast({ title: '没有已入库项', icon: 'none' }); return }
    Promise.all(done.map(i => col.doc(i._id).remove()))
      .then(() => {
        this._setItems(this.data.items.filter(i => !i.stockedIn))
        wx.showToast({ title: '已清除入库项', icon: 'success' })
      })
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  // ── 单条入库 ────────────────────────────────────────────
  onStockIn(e) {
    const { id } = e.currentTarget.dataset
    const item = this.data.items.find(i => i._id === id)
    if (!item || !item.inInventory || !item.ingredientId) return
    wx.showLoading({ title: '入库中…', mask: true })
    this._callStock([item], () => {
      wx.hideLoading()
      col.doc(id).update({ data: { stockedIn: true, updatedAt: Date.now() } }).catch(() => {})
      this._setItems(this.data.items.map(i => i._id === id ? { ...i, stockedIn: true } : i))
      wx.showToast({ title: '已入库 ✓', icon: 'success' })
    }, () => wx.hideLoading())
  },

  // ── 一键全部入库 ─────────────────────────────────────────
  onStockInAll() {
    const eligible = this.data.items.filter(i => i.inInventory && !i.stockedIn && i.ingredientId)
    if (!eligible.length) { wx.showToast({ title: '没有可入库的项目', icon: 'none' }); return }
    wx.showModal({
      title:       `一键入库（${eligible.length} 项）`,
      content:     eligible.map(i => i.name).join('、') + '\n\n按当前采购数量增加库存。',
      confirmText: '确认入库',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ stockingAll: true })
        wx.showLoading({ title: '入库中…', mask: true })
        this._callStock(eligible, () => {
          wx.hideLoading()
          const doneIds = new Set(eligible.map(i => i._id))
          Promise.all(eligible.map(i =>
            col.doc(i._id).update({ data: { stockedIn: true, updatedAt: Date.now() } })
          )).catch(() => {})
          this._setItems(this.data.items.map(i => doneIds.has(i._id) ? { ...i, stockedIn: true } : i))
          this.setData({ stockingAll: false })
          wx.showToast({ title: `${eligible.length} 项已入库 ✓`, icon: 'success' })
        }, () => {
          wx.hideLoading()
          this.setData({ stockingAll: false })
        })
      },
    })
  },

  _callStock(items, onSuccess, onFail) {
    Promise.all(items.map(item =>
      wx.cloud.callFunction({
        name: 'ingredients',
        data: { action: 'stock', id: item.ingredientId, payload: { delta: item.suggestQty, reason: '采购入库' } },
      })
    )).then(results => {
      const failed = results.filter(r => !(r.result && r.result.success))
      if (failed.length) wx.showToast({ title: `${failed.length} 项入库失败`, icon: 'none', duration: 2500 })
      onSuccess()
    }).catch(() => {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      if (onFail) onFail()
    })
  },

  // ── 去录入新原料 ─────────────────────────────────────────
  onGoAddIngredient() {
    wx.navigateTo({ url: '/pages/ingredient-form/ingredient-form' })
  },

  // ── 清空整单 ────────────────────────────────────────────
  onClearAll() {
    if (!this.data.items.length) return
    wx.showModal({
      title: '清空采购清单', content: '将移除所有采购项，此操作不可撤销。',
      confirmText: '清空', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        Promise.all(this.data.items.map(i => col.doc(i._id).remove()))
          .then(() => this._setItems([]))
          .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
      },
    })
  },
})
