// pages/sales-records/sales-records.js

function _call(data) {
  return wx.cloud.callFunction({ name: 'analytics', data }).then(r => r.result || {})
}
function _todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

Page({
  data: {
    records:      [],
    loading:      false,
    totalRevenue: 0,
    totalCups:    0,
    // 弹窗
    showModal:    false,
    editDate:     '',
    isEdit:       false,
    form:         { revenue: '', cups: '', note: '' },
    formLoading:  false,
  },

  onShow() { this._load() },

  _load() {
    this.setData({ loading: true })
    _call({ action: 'saleList', limit: 60 }).then(r => {
      const records      = r.data || []
      const totalRevenue = records.reduce((s, i) => s + (i.revenue || 0), 0)
      const totalCups    = records.reduce((s, i) => s + (i.cups    || 0), 0)
      this.setData({ records, totalRevenue, totalCups, loading: false })
    }).catch(() => this.setData({ loading: false }))
  },

  // ── 新建 ────────────────────────────────────────────────
  onAddRecord() {
    const today = _todayStr()
    const exist = this.data.records.find(r => r.date === today)
    this.setData({
      showModal:  true,
      editDate:   today,
      isEdit:     !!exist,
      form: {
        revenue: exist ? String(exist.revenue) : '',
        cups:    exist ? String(exist.cups || '') : '',
        note:    exist ? (exist.note || '') : '',
      },
    })
  },

  // ── 编辑 ────────────────────────────────────────────────
  onEdit(e) {
    const date = e.currentTarget.dataset.date
    const rec  = this.data.records.find(r => r.date === date)
    if (!rec) return
    this.setData({
      showModal: true,
      editDate:  date,
      isEdit:    true,
      form: {
        revenue: String(rec.revenue),
        cups:    String(rec.cups || ''),
        note:    rec.note || '',
      },
    })
  },

  onCloseModal() { this.setData({ showModal: false }) },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  onSubmit() {
    const { form, editDate, formLoading } = this.data
    if (formLoading) return
    const revenue = Number(form.revenue)
    if (!revenue || revenue <= 0) { wx.showToast({ title: '请输入营业额', icon: 'none' }); return }
    this.setData({ formLoading: true })
    _call({ action: 'saleAdd', date: editDate, revenue, cups: Number(form.cups) || 0, note: form.note || '' })
      .then(r => {
        this.setData({ formLoading: false })
        if (r.success) {
          this.setData({ showModal: false })
          wx.showToast({ title: '已保存 ✓', icon: 'success' })
          this._load()
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }).catch(() => {
        this.setData({ formLoading: false })
        wx.showToast({ title: '网络异常', icon: 'none' })
      })
  },

  // ── 删除 ────────────────────────────────────────────────
  onDelete(e) {
    const date = e.currentTarget.dataset.date
    wx.showModal({
      title: '删除记录', content: `确定删除 ${date} 的营业记录？`,
      confirmText: '删除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        _call({ action: 'saleDelete', date }).then(r => {
          if (r.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            this._load()
          }
        })
      },
    })
  },
})
