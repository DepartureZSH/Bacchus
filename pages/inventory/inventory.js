// pages/inventory/inventory.js
const DB = require('../../data/ingredients')
const { getStockPct, groupByCat, calcStatus } = require('../../utils/helper')
const { normalizeBarcode, guessUnit, guessCat } = require('../../utils/helper')

const BARCODE_API1 = {
  url: 'https://api.yyy001.com/api/barcode',
  key: '35a77bc6-1b2e-84ba-a5fa-a3e82573f62df95be276'
}

const ALL_CATS    = ['全部', '基酒', '利口酒', '辅料', '果汁', '糖浆', '装饰']
const OUT_REASONS = ['调酒出杯', '制作预调', '损耗/报废', '活动用酒', '盘点修正', '其他']

const EMPTY_OUT_FORM = {
  ingredient:   null,
  qty:          1,
  reason:       '调酒出杯',
  customReason: '',
  resultStock:  0,
  resultStatus: 'ok',
}

Page({
  data: {
    categories:     ALL_CATS,
    currentCat:     '全部',
    searchText:     '',
    filteredGroups: [],
    stats:          { total:0, ok:0, warn:0, danger:0 },
    showScanSheet:  false,
    showOutDrawer:  false,
    outForm:        { ...EMPTY_OUT_FORM },
    outSearch:      '',
    outSearchList:  [],
    outReasons:     OUT_REASONS,
    outError:       '',
    loading:        false,
  },

  onLoad() { this._render() },
  onShow()  { this._render() },

  _render() {
    const { currentCat, searchText } = this.data
    this.setData({ loading: true })

    DB.getAll().then(list => {
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase()
        list = list.filter(i => i.name.includes(q) || (i.brand||'').toLowerCase().includes(q))
      }
      if (currentCat !== '全部') {
        list = list.filter(i => i.cat === currentCat)
      }
      list = list.map(i => ({ ...i, stockPct: getStockPct(i.stock, i.threshold) }))
      const filteredGroups = groupByCat(list)
      const stats = {
        total:  list.length,
        ok:     list.filter(i => i.status === 'ok').length,
        warn:   list.filter(i => i.status === 'warn').length,
        danger: list.filter(i => i.status === 'danger').length,
      }
      this.setData({ filteredGroups, stats, loading: false })
    }).catch(() => this.setData({ loading: false }))
  },

  onSearch(e)    { this.setData({ searchText: e.detail.value }, () => this._render()) },
  onFilterCat(e) { this.setData({ currentCat: e.currentTarget.dataset.cat }, () => this._render()) },
  onIngTap(e)    { wx.navigateTo({ url: `/pages/inventory-detail/inventory-detail?id=${e.currentTarget.dataset.id}` }) },
  onAddIngredient() { wx.navigateTo({ url: '/pages/ingredient-form/ingredient-form' }) },
  stopProp() {},

  // 快捷出库（列表行右侧 − 按钮）
  onQuickOut(e) {
    const { id } = e.currentTarget.dataset
    DB.getById(id).then(ing => {
      if (!ing) return
      this._openOutDrawer(ing)
    })
  },

  // 扫码选择弹出栏
  onScanBtn()       { this.setData({ showScanSheet: true }) },
  onCloseScanSheet(){ this.setData({ showScanSheet: false }) },
  onScanSheetIn()   { this.setData({ showScanSheet: false }); this.onScanIn() },
  onScanSheetOut()  { this.setData({ showScanSheet: false }); this.onScanOut() },

  // 扫码出库
  onScanOut() {
    wx.scanCode({
      scanType: ['barCode'],
      success: (res) => {
        const code = (res.result || '').trim()
        DB.getByBarcode(code).then(local => {
          if (local) {
            this._openOutDrawer(local)
            return
          }
          wx.showLoading({ title: '查询中…' })
          wx.request({
            url: BARCODE_API1.url,
            data: { apikey: BARCODE_API1.key, barcode: code },
            success: (r) => {
              wx.hideLoading()
              const info = (r.data && r.data.code === 1) ? r.data.data : null
              wx.showModal({
                title:   '未匹配本地原料',
                content: info
                  ? `条码对应：${info.goodsName}\n该原料尚未录入库存，是否去新增？`
                  : `条码 ${code} 未匹配本地原料，是否去新增？`,
                confirmText: '去新增',
                success: (mr) => {
                  if (mr.confirm) wx.navigateTo({ url: `/pages/ingredient-form/ingredient-form?barcode=${code}` })
                }
              })
            },
            fail: () => {
              wx.hideLoading()
              wx.showModal({
                title: '未匹配本地原料',
                content: `条码 ${code} 未匹配，是否去新增？`,
                confirmText: '去新增',
                success: (mr) => { if (mr.confirm) wx.navigateTo({ url: `/pages/ingredient-form/ingredient-form?barcode=${code}` }) }
              })
            }
          })
        })
      },
      fail: () => wx.showToast({ title: '扫码已取消', icon: 'none' })
    })
  },

  // 扫码入库
  onScanIn() {
    wx.scanCode({
      scanType: ['barCode'],
      success: (res) => {
        const code = (res.result || '').trim()
        if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) {
          wx.showToast({ title: '不是有效条码', icon: 'none' }); return
        }
        DB.getByBarcode(code).then(local => {
          if (local) {
            wx.showModal({
              title: '已有该原料',
              content: `"${local.name}" 已在库存，去详情页手动入库？`,
              confirmText: '去详情',
              success: (r) => {
                if (r.confirm) wx.navigateTo({ url: `/pages/inventory-detail/inventory-detail?id=${local._id || local.id}` })
              }
            })
            return
          }
          wx.showModal({
            title: '未找到该商品',
            content: `条码：${code}\n跳转新增页面并自动查询？`,
            confirmText: '新增',
            success: (r) => { if (r.confirm) wx.navigateTo({ url: `/pages/ingredient-form/ingredient-form?barcode=${code}` }) }
          })
        })
      },
      fail: () => wx.showToast({ title: '扫码已取消', icon: 'none' })
    })
  },

  // 打开出库抽屉
  _openOutDrawer(ing) {
    const qty          = 1
    const resultStock  = ing.stock - qty
    const resultStatus = calcStatus(resultStock, ing.threshold)
    DB.getAll().then(list => {
      const outSearchList = list.map(i => ({ ...i, stockPct: getStockPct(i.stock, i.threshold) }))
      this.setData({
        showOutDrawer: true,
        outError:      '',
        outSearch:     '',
        outSearchList,
        outForm: { ...EMPTY_OUT_FORM, ingredient: ing, qty, resultStock, resultStatus },
      })
    })
  },

  onCloseOutDrawer() { this.setData({ showOutDrawer: false, outError: '' }) },

  onChangeIngredient() {
    DB.getAll().then(list => {
      const all = list.map(i => ({ ...i, stockPct: getStockPct(i.stock, i.threshold) }))
      this.setData({ 'outForm.ingredient': null, outSearch: '', outSearchList: all })
    })
  },

  onOutSearch(e) {
    const q = (e.detail.value || '').trim().toLowerCase()
    DB.getAll().then(list => {
      const filtered = list
        .filter(i => !q || i.name.includes(q) || (i.brand||'').toLowerCase().includes(q))
        .map(i => ({ ...i, stockPct: getStockPct(i.stock, i.threshold) }))
      this.setData({ outSearch: e.detail.value, outSearchList: filtered })
    })
  },

  onPickIngredient(e) {
    const id = e.currentTarget.dataset.id
    DB.getById(id).then(ing => {
      if (!ing) return
      const qty          = 1
      const resultStock  = ing.stock - qty
      const resultStatus = calcStatus(resultStock, ing.threshold)
      this.setData({
        'outForm.ingredient':   ing,
        'outForm.qty':          qty,
        'outForm.resultStock':  resultStock,
        'outForm.resultStatus': resultStatus,
        outSearch: '',
        outError:  '',
      })
    })
  },

  _recalc(qty) {
    const ing = this.data.outForm.ingredient
    if (!ing) return
    const safeQty      = Math.max(0.01, qty)
    const resultStock  = Math.round((ing.stock - safeQty) * 100) / 100
    const resultStatus = calcStatus(resultStock, ing.threshold)
    this.setData({
      'outForm.qty':          safeQty,
      'outForm.resultStock':  resultStock,
      'outForm.resultStatus': resultStatus,
      outError: '',
    })
  },

  onQtyInput(e) {
    const v = parseFloat(e.detail.value)
    if (!isNaN(v) && v > 0) this._recalc(v)
  },
  onQtyMinus() {
    const cur  = this.data.outForm.qty
    const unit = this.data.outForm.ingredient && this.data.outForm.ingredient.unit
    const step = (unit === 'ml' || unit === 'g' || unit === 'cl' || unit === 'oz') ? 10 : 1
    this._recalc(Math.max(step, cur - step))
  },
  onQtyPlus() {
    const cur  = this.data.outForm.qty
    const unit = this.data.outForm.ingredient && this.data.outForm.ingredient.unit
    const step = (unit === 'ml' || unit === 'g' || unit === 'cl' || unit === 'oz') ? 10 : 1
    this._recalc(cur + step)
  },
  onSelectReason(e) { this.setData({ 'outForm.reason': e.currentTarget.dataset.val, outError: '' }) },
  onCustomReason(e) { this.setData({ 'outForm.customReason': e.detail.value }) },

  // 确认出库
  onConfirmOut() {
    const { ingredient, qty, reason, customReason, resultStock } = this.data.outForm
    if (!ingredient)    { this.setData({ outError: '请先选择原料' }); return }
    if (!qty || qty <= 0) { this.setData({ outError: '出库数量必须大于 0' }); return }
    if (resultStock < 0)  { this.setData({ outError: `库存不足，当前仅剩 ${ingredient.stock} ${ingredient.unit}` }); return }

    const finalReason = reason === '其他' ? (customReason.trim() || '其他') : reason
    const ingId       = ingredient._id || ingredient.id

    wx.showLoading({ title: '出库中…', mask: true })

    DB.adjustStock(ingId, -qty, finalReason).then(updated => {
      wx.hideLoading()
      this.setData({ showOutDrawer: false, outError: '' })
      this._render()

      wx.showToast({ title: `已出库 ${qty} ${ingredient.unit}`, icon: 'success', duration: 1500 })

      if (updated && updated.status === 'danger') {
        setTimeout(() => {
          wx.showModal({
            title:       `⚠ ${ingredient.name} 库存告急`,
            content:     `出库后余量：${updated.stock} ${ingredient.unit}，低于安全阈值 ${ingredient.threshold} ${ingredient.unit}\n\n是否立即加入采购清单？`,
            confirmText: '去采购', cancelText: '稍后',
            success: (res) => { if (res.confirm) wx.navigateTo({ url: '/pages/ai-menu/ai-menu?tab=purchase' }) }
          })
        }, 1800)
      }
    }).catch(err => {
      wx.hideLoading()
      const msg = err.code === 'insufficient_stock'
        ? `库存不足，当前仅剩 ${err.current} ${err.unit}`
        : '出库失败，请重试'
      this.setData({ outError: msg })
    })
  },
})
