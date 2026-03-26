// data/ingredients.js
// 原料数据层 v2.0 — 云开发版
// 对外函数签名与 v1（wx.storage）完全一致，所有调用方（15个页面）零改动
// 内部：内存缓存 + 云函数双层，离线时降级到缓存（只读）

const app = getApp()

// ── 默认预置数据（仅用于首次安装，离线降级时显示）─────────
const DEFAULT_INGREDIENTS = [
  { _id:'1', cat:'基酒',  emoji:'🥃', name:'金酒',          brand:'Tanqueray London Dry', unit:'ml', stock:150,  threshold:500, costPerUnit:0.28, barcode:'5000289003648', status:'danger' },
  { _id:'2', cat:'基酒',  emoji:'🥃', name:'伏特加',         brand:'Absolut Original',     unit:'ml', stock:850,  threshold:300, costPerUnit:0.22, barcode:'7312040017072', status:'ok'     },
  { _id:'3', cat:'基酒',  emoji:'🥃', name:'朗姆酒（白）',   brand:'Bacardí Carta Blanca',  unit:'ml', stock:720,  threshold:300, costPerUnit:0.24, barcode:'5010677014204', status:'ok'     },
  { _id:'4', cat:'基酒',  emoji:'🥃', name:'龙舌兰（银）',   brand:'Jose Cuervo Silver',    unit:'ml', stock:600,  threshold:300, costPerUnit:0.30, barcode:'080432402191',  status:'ok'     },
  { _id:'5', cat:'基酒',  emoji:'🥃', name:'威士忌（波本）', brand:"Maker's Mark",          unit:'ml', stock:480,  threshold:250, costPerUnit:0.42, barcode:'0080686011736', status:'ok'     },
  { _id:'6', cat:'利口酒',emoji:'🍊', name:'君度橙酒',       brand:'Cointreau',             unit:'ml', stock:380,  threshold:200, costPerUnit:0.38, barcode:'3035540001004', status:'ok'     },
  { _id:'7', cat:'利口酒',emoji:'🍑', name:'百香果利口酒',   brand:'Passoa',                unit:'ml', stock:290,  threshold:150, costPerUnit:0.35, barcode:'8718698113001', status:'ok'     },
  { _id:'8', cat:'利口酒',emoji:'💚', name:'苦艾酒',         brand:'Martini Extra Dry',     unit:'ml', stock:220,  threshold:100, costPerUnit:0.26, barcode:'8000570118901', status:'ok'     },
  { _id:'9', cat:'辅料',  emoji:'🧊', name:'苏打水',         brand:'圣沛黎洛',              unit:'ml', stock:2400, threshold:500, costPerUnit:0.01, barcode:'8001040015452', status:'ok'     },
  { _id:'10',cat:'辅料',  emoji:'🥚', name:'蛋清',           brand:'新鲜',                  unit:'个', stock:12,   threshold:6,   costPerUnit:1.50, barcode:'',              status:'ok'     },
  { _id:'11',cat:'辅料',  emoji:'🧊', name:'冰块',           brand:'机制冰',                unit:'kg', stock:8,    threshold:3,   costPerUnit:2.00, barcode:'',              status:'ok'     },
  { _id:'12',cat:'果汁',  emoji:'🍋', name:'青柠汁（新鲜）', brand:'现榨',                  unit:'ml', stock:120,  threshold:400, costPerUnit:0.05, barcode:'',              status:'danger' },
  { _id:'13',cat:'果汁',  emoji:'🍊', name:'橙汁',           brand:'特别鲜',                unit:'ml', stock:600,  threshold:300, costPerUnit:0.02, barcode:'6928804011397', status:'ok'     },
  { _id:'14',cat:'果汁',  emoji:'🍍', name:'菠萝汁',         brand:'Dole',                  unit:'ml', stock:480,  threshold:200, costPerUnit:0.03, barcode:'0038900012604', status:'ok'     },
  { _id:'15',cat:'糖浆',  emoji:'🍯', name:'简单糖浆',       brand:'自制',                  unit:'ml', stock:400,  threshold:200, costPerUnit:0.02, barcode:'',              status:'ok'     },
  { _id:'16',cat:'糖浆',  emoji:'🌹', name:'玫瑰糖浆',       brand:'Monin',                 unit:'ml', stock:240,  threshold:100, costPerUnit:0.06, barcode:'3052910006106', status:'ok'     },
  { _id:'17',cat:'糖浆',  emoji:'🍓', name:'草莓糖浆',       brand:'Monin',                 unit:'ml', stock:180,  threshold:150, costPerUnit:0.06, barcode:'3052910059606', status:'warn'   },
  { _id:'18',cat:'装饰',  emoji:'🌿', name:'薄荷叶（新鲜）', brand:'新鲜',                  unit:'把', stock:1,    threshold:3,   costPerUnit:3.00, barcode:'',              status:'warn'   },
]

// ── 内存缓存 ────────────────────────────────────────────────
let _cache = null             // 原料列表缓存
let _initialized = false      // 是否已从云端加载过一次

// ── 工具：调用云函数 ────────────────────────────────────────
function callCloud(action, payload = {}, id, offset, limit) {
  return wx.cloud.callFunction({
    name: 'ingredients',
    data: Object.assign({ action, payload }, id !== undefined && { id }, offset !== undefined && { offset }, limit !== undefined && { limit }),
  }).then(res => res.result)
}

// ── 工具：status 计算（本地降级用）─────────────────────────
function calcStatus(stock, threshold) {
  if (stock < threshold * 0.3) return 'danger'
  if (stock < threshold)       return 'warn'
  return 'ok'
}

// ── 工具：stockPct 计算 ─────────────────────────────────────
function getStockPct(stock, threshold) {
  if (!threshold) return 100
  return Math.min(100, Math.round((stock / (threshold * 2)) * 100))
}

// ── 工具：补充前端展示字段（stockPct / id 兼容）───────────
function normalize(item) {
  return {
    ...item,
    id:       item._id || item.id,   // 兼容页面用 ing.id 的地方
    stockPct: getStockPct(item.stock, item.threshold),
    status:   item.status || calcStatus(item.stock, item.threshold),
  }
}

// ── getAll：获取全部原料（优先内存缓存，后台刷新）─────────
// 返回 Promise<Array>，调用方用 .then() 接收
function getAll(opts = {}) {
  const { forceRefresh = false } = opts

  if (_cache && !forceRefresh && _initialized) {
    // 命中缓存：立即返回，后台静默刷新
    _silentRefresh()
    return Promise.resolve([..._cache])
  }

  // 未初始化或强制刷新：直接从云端拉取
  return _fetchFromCloud()
}

function _fetchFromCloud() {
  if (app.globalData.isOffline) {
    // 离线：返回缓存或 DEFAULT
    return Promise.resolve(_cache ? [..._cache] : DEFAULT_INGREDIENTS.map(normalize))
  }

  return callCloud('list').then(result => {
    if (result && result.success) {
      _cache = result.data.map(normalize)
      _initialized = true
      return [..._cache]
    }
    return _cache ? [..._cache] : DEFAULT_INGREDIENTS.map(normalize)
  }).catch(() => {
    return _cache ? [..._cache] : DEFAULT_INGREDIENTS.map(normalize)
  })
}

function _silentRefresh() {
  if (app.globalData.isOffline) return
  callCloud('list').then(result => {
    if (result && result.success) {
      _cache = result.data.map(normalize)
    }
  }).catch(() => {})
}

// ── getById ─────────────────────────────────────────────────
function getById(id) {
  // 优先内存缓存
  if (_cache) {
    const item = _cache.find(i => i._id === id || i.id === id)
    if (item) return Promise.resolve(item)
  }
  return callCloud('get', {}, id).then(r => r && r.success ? normalize(r.data) : null)
}

// ── getByBarcode ─────────────────────────────────────────────
function getByBarcode(barcode) {
  if (!barcode) return Promise.resolve(null)
  // 先查缓存
  if (_cache) {
    const item = _cache.find(i => i.barcode === barcode)
    if (item) return Promise.resolve(item)
  }
  return callCloud('barcode', { code: barcode }).then(r => r && r.success && r.data ? normalize(r.data) : null)
}

// ── addIngredient ────────────────────────────────────────────
function addIngredient(data) {
  return callCloud('add', data).then(r => {
    if (r && r.success) {
      const item = normalize(r.data)
      if (_cache) _cache.unshift(item)
      return item
    }
    throw new Error(r && r.error || 'add failed')
  })
}

// ── updateIngredient ─────────────────────────────────────────
function updateIngredient(id, patch) {
  return callCloud('update', patch, id).then(r => {
    if (r && r.success) {
      const item = normalize(r.data)
      if (_cache) {
        const idx = _cache.findIndex(i => i._id === id || i.id === id)
        if (idx >= 0) _cache[idx] = item
      }
      return item
    }
    throw new Error(r && r.error || 'update failed')
  })
}

// ── deleteIngredient ─────────────────────────────────────────
function deleteIngredient(id) {
  return callCloud('remove', {}, id).then(r => {
    if (r && r.success) {
      if (_cache) _cache = _cache.filter(i => i._id !== id && i.id !== id)
      return true
    }
    throw new Error(r && r.error || 'delete failed')
  })
}

// ── adjustStock：出入库（核心）──────────────────────────────
function adjustStock(id, delta, reason) {
  return callCloud('stock', { delta, reason }, id).then(r => {
    if (r && r.success) {
      const item = normalize(r.data)
      // 更新内存缓存
      if (_cache) {
        const idx = _cache.findIndex(i => i._id === id || i.id === id)
        if (idx >= 0) _cache[idx] = item
      }
      return item
    }
    if (r && r.error === 'insufficient_stock') {
      throw Object.assign(new Error('库存不足'), { code: 'insufficient_stock', current: r.current, unit: r.unit })
    }
    throw new Error(r && r.error || 'stock failed')
  })
}

// ── getLogs：获取操作日志 ─────────────────────────────────
function getLogs(id, offset = 0, limit = 20) {
  return callCloud('logs', {}, id, offset, limit).then(r => r && r.success ? r.data : [])
}

// ── invalidateCache：强制失效缓存（供外部调用）────────────
function invalidateCache() {
  _cache = null
  _initialized = false
}

// ── resetToDefault（演示/调试用，不再写云端）─────────────
function resetToDefault() {
  _cache = DEFAULT_INGREDIENTS.map(normalize)
  _initialized = false
  console.warn('[DB] resetToDefault: 仅重置内存缓存，云端数据未修改')
}

module.exports = {
  getAll,
  getById,
  getByBarcode,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  adjustStock,
  getLogs,
  invalidateCache,
  resetToDefault,
  // 兼容旧代码直接访问 .INGREDIENTS 的场景（返回当前缓存，同步值）
  get INGREDIENTS() { return _cache || DEFAULT_INGREDIENTS.map(normalize) },
}
