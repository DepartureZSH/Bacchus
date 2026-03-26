// utils/helper.js

function getStockPct(stock, threshold) {
  if (stock >= threshold) return Math.min(100, Math.round((stock / (threshold * 2)) * 100))
  return `${Math.round((stock / threshold) * 100)}%`
}

function calcStatus(stock, threshold) {
  if (stock < threshold * 0.3) return 'danger'
  if (stock < threshold)       return 'warn'
  return 'ok'
}

const STATUS_TEXT = { danger: '严重不足', warn: '库存偏低', ok: '库存正常' }

function nowStr() {
  const d = new Date()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}

const CAT_ORDER = ['基酒', '利口酒', '辅料', '果汁', '糖浆', '装饰']

const CAT_EMOJI = {
  '基酒':   '🥃',
  '利口酒': '🍊',
  '辅料':   '🧊',
  '果汁':   '🍋',
  '糖浆':   '🍯',
  '装饰':   '🌿',
}

function groupByCat(list) {
  const map = {}
  list.forEach(ing => {
    if (!map[ing.cat]) map[ing.cat] = []
    map[ing.cat].push(ing)
  })
  return CAT_ORDER.filter(cat => map[cat]).map(cat => ({ cat, items: map[cat] }))
}

// ─────────────────────────────────────────────────────────────
// 扫码 API 结果归一化
// 支持两种接口返回格式，统一输出 BarcodeResult
//
// BarcodeResult {
//   barcode: string
//   name:    string   // 商品名
//   brand:   string   // 品牌
//   spec:    string   // 规格，如 "750ml"
//   price:   string   // 参考价格
//   source:  'api1' | 'api2' | 'unknown'
// }
// ─────────────────────────────────────────────────────────────
function normalizeBarcode(apiResponse, source) {
  if (!apiResponse) return null
  let name = '', brand = '', spec = '', price = '', barcode = ''

  if (source === 'api1') {
    // { code:1, data:{ barcode, brand, goodsName, price, standard, supplier } }
    const d = apiResponse.data || {}
    barcode = d.barcode  || ''
    name    = d.goodsName || ''
    brand   = d.brand    || ''
    spec    = d.standard || ''
    price   = d.price    || ''
  } else if (source === 'api2') {
    const body = apiResponse.showapi_res_body || {}
    barcode = body.code      || ''
    name    = body.goodsName || ''
    brand   = body.trademark || ''
    spec    = body.spec      || ''
    price   = body.price     || ''
  }
  console.log("name: ", name)
  if (!name) return null

  return { barcode, name, brand, spec, price, source }
}

// 从商品名+规格里猜测单位（辅助填表，可人工修改）
function guessUnit(name, spec) {
  const text = (name + spec).toLowerCase()
  if (/ml|毫升/.test(text)) return 'ml'
  if (/l\b|升/.test(text))  return 'l'
  if (/g\b|克/.test(text))  return 'g'
  if (/kg|千克/.test(text)) return 'kg'
  if (/瓶|罐|盒|包/.test(text)) return '个'
  return 'ml'   // 酒类默认 ml
}

// 从商品名猜测品类（辅助填表，可人工修改）
function guessCat(name) {
  if (/伏特加|威士忌|朗姆|龙舌兰|金酒|白兰地|白酒|烈酒/.test(name)) return '基酒'
  if (/利口酒|力娇|甜酒|橙酒|苦艾/.test(name))                       return '利口酒'
  if (/果汁|柠檬汁|青柠|橙汁|菠萝汁/.test(name))                     return '果汁'
  if (/糖浆|糖水/.test(name))                                         return '糖浆'
  if (/薄荷|柠檬片|橙片|装饰/.test(name))                            return '装饰'
  return '辅料'
}

module.exports = {
  getStockPct, calcStatus, STATUS_TEXT, nowStr,
  CAT_ORDER, CAT_EMOJI, groupByCat,
  normalizeBarcode, guessUnit, guessCat
}
