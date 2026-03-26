// data/myRecipes.js
// Phase 5：云函数适配器 + recipe_images 封面图支持
//
// 封面图机制：
//   - `recipe_images` 集合存所有生成记录，isCover=true 的为当前封面
//   - preload 时调 imageCoverMap 拉取 targetId→fileID 映射，存内存
//   - getMyAll / getCollAll 自动注入 coverFileID 字段
//   - tempUrl 由页面层调 wx.cloud.getTempFileURL 按需换，存 wx.storage（TTL 90min）
//   - 下次进入页面先查 storage，命中直接渲染；过期或未命中再换新 tempUrl

// ── 内存缓存 ──────────────────────────────────────────────
let _cache = {
  myList:     null,
  favIds:     null,
  favCollIds: null,  // { [publishId]: true }，收藏的公开合集
  colls:      null,
  coverMap:   null,  // { [targetId]: fileID }，来自 recipe_images.isCover=true
  fetchedAt:  0,
}
const CACHE_TTL = 60 * 1000

// ── tempUrl 本地持久化缓存（wx.storage）─────────────────
// key: fileID（永久有效）→ { url, ts }
// tempUrl 微信官方 2 小时有效，TTL 设 50 分钟，留足刷新余量
const COVER_STORAGE_KEY = 'bacchus_cover_urls'
const TEMP_URL_TTL      = 50 * 60 * 1000

function _loadUrlStorage() {
  try { return wx.getStorageSync(COVER_STORAGE_KEY) || {} } catch (_) { return {} }
}
function _saveUrlStorage(map) {
  try { wx.setStorageSync(COVER_STORAGE_KEY, map) } catch (_) {}
}

// 读取单个 fileID 对应的缓存 tempUrl（过期返回 null）
function getCachedTempUrl(fileID) {
  if (!fileID) return null
  const store = _loadUrlStorage()
  const entry = store[fileID]
  if (!entry) return null
  if (Date.now() - entry.ts > TEMP_URL_TTL) return null
  return entry.url
}

// 批量写入 fileID→url 到 storage
function _batchSaveUrls(pairs) {
  if (!pairs || !pairs.length) return
  const store = _loadUrlStorage()
  const now   = Date.now()
  pairs.forEach(({ fileID, url }) => { if (fileID && url) store[fileID] = { url, ts: now } })
  _saveUrlStorage(store)
}

// 供外部（my-recipes.js）在拿到新 tempUrl 后立即写缓存
function saveTempUrl(fileID, url) {
  if (fileID && url) _batchSaveUrls([{ fileID, url }])
}

// ── coverMap 注入 ─────────────────────────────────────────
// 把 coverMap 中的 fileID 注入到列表条目的 coverFileID 字段
function _injectCover(list) {
  if (!list || !list.length || !_cache.coverMap) return list
  return list.map(r => {
    const id     = r._id || r.id
    const fileID = _cache.coverMap[id]
    if (!fileID) return r
    // 只注入 coverFileID；coverTempUrl 由页面层统一换新（避免使用过期 URL）
    return { ...r, coverFileID: fileID, coverTempUrl: '' }
  })
}

// ── 工具函数 ──────────────────────────────────────────────
function _isOffline() { return !!(getApp().globalData && getApp().globalData.isOffline) }

function _call(action, extra) {
  return wx.cloud.callFunction({ name: 'recipes', data: { action, ...extra } })
    .then(res => res.result || {})
}

// ── 同步读缓存 ────────────────────────────────────────────
function getMyAll()      { return _injectCover(_cache.myList || []) }
function getCollAll()    { return _injectCover(_cache.colls  || []) }
function getFavIds()        { return _cache.favIds    || {} }
function getFavCollIds()    { return _cache.favCollIds || {} }
function isFav(id)          { return !!(_cache.favIds    || {})[id] }
function isFavColl(pubId)   { return !!(_cache.favCollIds || {})[pubId] }
function getMyById(id)   {
  const r = (_cache.myList || []).find(x => x._id === id || x.id === id) || null
  if (!r) return null
  const fileID = _cache.coverMap && (_cache.coverMap[r._id || r.id])
  if (!fileID) return r
  return { ...r, coverFileID: fileID, coverTempUrl: '' }
}
function getCollById(id) { return (_cache.colls || []).find(c => c._id === id || c.id === id) || null }

// 供 my-recipes.js 拿到 tempUrl 后实时更新 coverMap 的内存条目
function updateCoverTempUrl(targetId, fileID, tempUrl) {
  // 更新 coverMap 中的 fileID（若换了封面）
  if (_cache.coverMap && fileID) _cache.coverMap[targetId] = fileID
  // 写 storage
  if (fileID && tempUrl) saveTempUrl(fileID, tempUrl)
  // 更新内存列表中的 coverTempUrl
  _inplacePatchCoverUrl(targetId, fileID, tempUrl)
}

function _inplacePatchCoverUrl(targetId, fileID, tempUrl) {
  ;(_cache.myList || []).forEach(r => {
    if ((r._id || r.id) === targetId) {
      r.coverFileID  = fileID
      r.coverTempUrl = tempUrl
    }
  })
  ;(_cache.colls || []).forEach(c => {
    if ((c._id || c.id) === targetId) {
      c.coverFileID  = fileID
      c.coverTempUrl = tempUrl
    }
  })
}

// ── preload ───────────────────────────────────────────────
function preload() {
  if (_isOffline()) return Promise.resolve()
  const now = Date.now()
  if (_cache.myList && (now - _cache.fetchedAt) < CACHE_TTL) return Promise.resolve()

  return Promise.all([
    _call('list').then(r => { if (r.success) _cache.myList = r.data }),
    _call('getFavIds').then(r => { if (r.success) _cache.favIds = r.favIds }),
    _call('getFavCollIds').then(r => { if (r.success) _cache.favCollIds = r.favCollIds }),
    _call('collList').then(r => { if (r.success) _cache.colls = r.data }),
    _call('imageCoverMap').then(r => {
      if (r.success) {
        const map = {}
        ;(r.data || []).forEach(({ targetId, fileID }) => { map[targetId] = fileID })
        _cache.coverMap = map
      }
    }),
  ]).then(() => { _cache.fetchedAt = Date.now() })
}

// ── 异步 CRUD ─────────────────────────────────────────────
function fetchMyAll(opts) {
  if (_isOffline()) return Promise.resolve(_cache.myList || [])
  return _call('list', opts || {}).then(r => {
    if (r.success) { _cache.myList = r.data; _cache.fetchedAt = Date.now() }
    return r.success ? r.data : (_cache.myList || [])
  })
}

function addMyRecipe(data) {
  return _call('add', { payload: data }).then(r => {
    if (r.success && _cache.myList) _cache.myList.unshift(r.data)
    return r.data
  })
}

function updateMyRecipe(id, patch) {
  return _call('update', { id, payload: patch }).then(r => {
    if (r.success) {
      // 乐观更新内存缓存
      if (_cache.myList) {
        const idx = _cache.myList.findIndex(x => x._id === id || x.id === id)
        if (idx >= 0) _cache.myList[idx] = { ..._cache.myList[idx], ...patch }
      }
      return true
    }
    // 云端失败：不更新缓存，返回 false 让调用方处理
    console.error('[updateMyRecipe] cloud error:', r.error)
    return false
  })
}

function deleteMyRecipe(id) {
  return _call('remove', { id }).then(r => {
    if (r.success && _cache.myList) {
      _cache.myList = _cache.myList.filter(x => x._id !== id && x.id !== id)
    }
    if (r.success && _cache.colls) {
      _cache.colls.forEach(c => {
        c.recipeIds = (c.recipeIds || []).filter(rid => rid !== id)
        c.recipes   = (c.recipes   || []).filter(x => x._id !== id && x.id !== id)
      })
    }
    if (r.success && _cache.coverMap) delete _cache.coverMap[id]
    return r.success
  })
}

function toggleFav(id) {
  const favIds   = _cache.favIds || {}
  const isNowFav = !favIds[id]
  if (isNowFav) favIds[id] = true; else delete favIds[id]
  _cache.favIds = favIds
  _call('toggleFav', { id })
    .then(r => { if (r.success) _cache.favIds = r.favIds })
    .catch(() => {
      if (isNowFav) delete (_cache.favIds || {})[id]
      else (_cache.favIds || {})[id] = true
    })
  return isNowFav
}

function toggleFavColl(publishId) {
  const favCollIds = _cache.favCollIds || {}
  const isNowFav   = !favCollIds[publishId]
  if (isNowFav) favCollIds[publishId] = true; else delete favCollIds[publishId]
  _cache.favCollIds = favCollIds
  _call('toggleFavColl', { id: publishId })
    .then(r => { if (r.success) _cache.favCollIds = r.favCollIds })
    .catch(() => {
      if (isNowFav) delete (_cache.favCollIds || {})[publishId]
      else (_cache.favCollIds || {})[publishId] = true
    })
  return isNowFav
}

function addCollection(data) {
  return _call('collAdd', { payload: data }).then(r => {
    if (r.success && _cache.colls) _cache.colls.unshift({ ...r.data, recipes: [], count: 0 })
    return r.data
  })
}

function updateCollection(id, patch) {
  return _call('collUpdate', { id, payload: patch }).then(r => {
    if (r.success && _cache.colls) {
      const idx = _cache.colls.findIndex(c => c._id === id || c.id === id)
      if (idx >= 0) _cache.colls[idx] = { ..._cache.colls[idx], ...patch }
    }
    return r.success
  })
}

function deleteCollection(id) {
  return _call('collRemove', { id }).then(r => {
    if (r.success && _cache.colls) {
      _cache.colls = _cache.colls.filter(c => c._id !== id && c.id !== id)
    }
    if (r.success && _cache.coverMap) delete _cache.coverMap[id]
    return r.success
  })
}

function addToCollection(collId, recipeId) {
  return _call('collToggle', { collId, recipeId }).then(r => {
    if (r.success && _cache.colls) {
      const c = _cache.colls.find(x => x._id === collId || x.id === collId)
      if (c) {
        c.recipeIds = c.recipeIds || []
        if (!c.recipeIds.includes(recipeId)) c.recipeIds.push(recipeId)
        c.count = c.recipeIds.length
      }
    }
    return r.isIn
  })
}

function removeFromCollection(collId, recipeId) {
  return _call('collToggle', { collId, recipeId }).then(r => {
    if (r.success && _cache.colls) {
      const c = _cache.colls.find(x => x._id === collId || x.id === collId)
      if (c) {
        c.recipeIds = (c.recipeIds || []).filter(id => id !== recipeId)
        c.recipes   = (c.recipes   || []).filter(x => x._id !== recipeId && x.id !== recipeId)
        c.count = c.recipeIds.length
      }
    }
    return !r.isIn
  })
}

function clearCache() {
  _cache = { myList: null, favIds: null, favCollIds: null, colls: null, coverMap: null, fetchedAt: 0 }
}

// 只重置 fetchedAt，让下次 preload 强制重新拉云端数据（不清空内存中的显示数据）
function invalidateCache() {
  _cache.fetchedAt = 0
}

module.exports = {
  getMyAll, getMyById, getFavIds, isFav,
  getFavCollIds, isFavColl,
  getCollAll, getCollById,
  preload, fetchMyAll,
  addMyRecipe, updateMyRecipe, deleteMyRecipe,
  toggleFav, toggleFavColl,
  addCollection, updateCollection, deleteCollection,
  addToCollection, removeFromCollection,
  // 封面图 tempUrl 缓存
  getCachedTempUrl, saveTempUrl, updateCoverTempUrl,
  clearCache, invalidateCache,
}
