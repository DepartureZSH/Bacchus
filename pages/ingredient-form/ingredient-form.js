// pages/ingredient-form/ingredient-form.js
const DB = require('../../data/ingredients')
const { CAT_ORDER, CAT_EMOJI, normalizeBarcode, guessUnit, guessCat } = require('../../utils/helper')

const BARCODE_API1 = {
  url: 'https://api.yyy001.com/api/barcode',
  key: '35a77bc6-1b2e-84ba-a5fa-a3e82573f62df95be276'
}
const BARCODE_API2 = {
  url:     'https://barcode2.market.alicloudapi.com/barcode',
  appcode: 'a1205702e37449869c0840b2d6b5e993'
}

const EMPTY_FORM = {
  name: '', brand: '', cat: '基酒', unit: 'ml',
  stockStr: '', thresholdStr: '', costStr: '', barcode: '',
}

Page({
  data: {
    isEdit:   false,
    editId:   null,
    form:     { ...EMPTY_FORM },
    cats:     CAT_ORDER,
    units:    ['ml', 'l', 'g', 'kg', '个', '把', '瓶'],
    scanState: 'idle',
    scanHint:  '',
    scanHintType: 'ok',
    errorMsg:  '',
    submitting: false,
  },

  onLoad(query) {
    if (query.barcode && !query.id) {
      this.setData({ 'form.barcode': query.barcode })
      setTimeout(() => this._queryAPI1(query.barcode), 300)
    }
    if (query.id) {
      // 编辑模式：_id 是字符串
      this._editId = query.id
      DB.getById(query.id).then(ing => {
        if (!ing) return
        this.setData({
          isEdit: true,
          editId: ing._id || ing.id,
          form: {
            name:         ing.name,
            brand:        ing.brand || '',
            cat:          ing.cat,
            unit:         ing.unit,
            stockStr:     String(ing.stock),
            thresholdStr: String(ing.threshold),
            costStr:      String(ing.costPerUnit),
            barcode:      ing.barcode || '',
          }
        })
        wx.setNavigationBarTitle({ title: '编辑原料' })
      })
    }
  },

  onInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value, errorMsg: '' })
  },
  onSelectCat(e)  { this.setData({ 'form.cat':  e.currentTarget.dataset.val }) },
  onSelectUnit(e) { this.setData({ 'form.unit': e.currentTarget.dataset.val }) },

  onScan() {
    wx.scanCode({
      scanType: ['barCode'],
      success: (res) => {
        const code = (res.result || '').trim()
        if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) {
          wx.showToast({ title: '不是有效条码', icon: 'none' }); return
        }
        this.setData({ 'form.barcode': code })
        DB.getByBarcode(code).then(local => {
          if (local) {
            this._applyBarcodeResult({ barcode: code, name: local.name, brand: local.brand, spec: '', source: 'local' })
          } else {
            this._queryAPI1(code)
          }
        })
      },
      fail: () => wx.showToast({ title: '扫码已取消', icon: 'none' })
    })
  },

  _queryAPI1(code) {
    this.setData({ scanState: 'loading', scanHint: '正在查询商品信息…', scanHintType: 'ok' })
    wx.request({
      url: BARCODE_API1.url, method: 'GET',
      data: { apikey: BARCODE_API1.key, barcode: code },
      success: (res) => {
        const d = res.data || {}
        if (d.code === 1 && d.data && d.data.goodsName) {
          this._applyBarcodeResult(normalizeBarcode(d, 'api1'))
        } else {
          this._queryAPI2(code)
        }
      },
      fail: () => this._queryAPI2(code)
    })
  },

  _queryAPI2(code) {
    wx.request({
      url: BARCODE_API2.url, method: 'GET',
      header: { 'Authorization': `APPCODE ${BARCODE_API2.appcode}` },
      data: { code },
      success: (res) => {
        const body = ((res.data || {}).data || {}).showapi_res_body || {}
        if (body.flag && body.goodsName) {
          this._applyBarcodeResult(normalizeBarcode(res.data, 'api2'))
        } else {
          this._scanNoResult(code)
        }
      },
      fail: () => this._scanNoResult(code)
    })
  },

  _applyBarcodeResult(result) {
    if (!result) { this._scanNoResult(this.data.form.barcode); return }
    const form = { ...this.data.form }
    if (!form.name)  form.name  = result.name
    if (!form.brand) form.brand = result.brand || ''
    if (form.cat === '基酒') form.cat   = guessCat(result.name)
    if (form.unit === 'ml')  form.unit  = guessUnit(result.name, result.spec)
    form.barcode = result.barcode || form.barcode
    const hint = result.source === 'local'
      ? `✓ 本地已有"${result.name}"，信息已填入`
      : `✓ 查询成功：${result.name}${result.spec ? '  ' + result.spec : ''}`
    this.setData({ form, scanState: 'ok', scanHint: hint, scanHintType: 'ok' })
  },

  _scanNoResult(code) {
    this.setData({ scanState: 'fail', scanHint: `未查到条码 ${code} 的商品信息，请手动填写`, scanHintType: 'warn' })
  },

  onSubmit() {
    if (this.data.submitting) return
    const { form, isEdit, editId } = this.data

    if (!form.name.trim())       { this.setData({ errorMsg: '原料名称不能为空' }); return }
    if (!form.stockStr && !isEdit) { this.setData({ errorMsg: '请填写当前库存' }); return }
    if (!form.thresholdStr)      { this.setData({ errorMsg: '请填写低库存阈值' }); return }

    const stock     = parseFloat(form.stockStr)     || 0
    const threshold = parseFloat(form.thresholdStr) || 0
    const cost      = parseFloat(form.costStr)      || 0
    const emoji     = CAT_EMOJI[form.cat] || '📦'

    const payload = {
      name: form.name.trim(), brand: form.brand.trim(),
      cat: form.cat, emoji, unit: form.unit,
      stock, threshold, costPerUnit: cost,
      barcode: form.barcode.trim(),
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: isEdit ? '保存中…' : '添加中…', mask: true })

    const action = isEdit
      ? DB.updateIngredient(editId, payload)
      : DB.addIngredient(payload)

    action.then(() => {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: isEdit ? '保存成功' : '添加成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    }).catch(err => {
      wx.hideLoading()
      this.setData({ submitting: false, errorMsg: err.message || '操作失败，请重试' })
    })
  },
})
