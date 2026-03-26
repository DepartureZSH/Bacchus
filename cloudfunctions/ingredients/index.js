// cloudfunctions/ingredients/index.js
// 云函数：ingredients
// 处理：列表 / 新增 / 详情 / 更新 / 删除 / 出入库 / 条码查询 / 日志 / 数据迁移

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db    = cloud.database()
const _     = db.command
const col   = db.collection('ingredients')
const logs  = db.collection('stock_logs')

// ── 状态计算 ──────────────────────────────────────────
function calcStatus(stock, threshold) {
  if (stock < threshold * 0.3) return 'danger'
  if (stock < threshold)       return 'warn'
  return 'ok'
}

function nowISO() { return new Date().toISOString() }

// ── 主入口 ────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  const { action, payload = {}, id, offset = 0, limit = 50 } = event

  switch (action) {
    case 'list':     return await actionList(OPENID, payload)
    case 'get':      return await actionGet(OPENID, id)
    case 'add':      return await actionAdd(OPENID, payload)
    case 'update':   return await actionUpdate(OPENID, id, payload)
    case 'remove':   return await actionRemove(OPENID, id)
    case 'stock':    return await actionStock(OPENID, id, payload)
    case 'logs':     return await actionLogs(OPENID, id, offset, limit)
    case 'barcode':  return await actionBarcode(OPENID, payload.code)
    case 'migrate':  return await actionMigrate(OPENID, payload)
    default:
      return { success: false, error: 'unknown_action' }
  }
}

// ── list：获取原料列表 ────────────────────────────────
async function actionList(openid, payload) {
  try {
    const { cat, status, q } = payload

    // 构建查询条件
    const where = { _openid: openid }
    if (cat && cat !== '全部') where.cat = cat
    if (status && status !== 'all') where.status = status

    let query = col.where(where).orderBy('status', 'asc').orderBy('name', 'asc').limit(200)

    const { data } = await query.get()

    // 本地搜索（云数据库不支持模糊查询）
    let result = data
    if (q) {
      const kw = q.toLowerCase()
      result = data.filter(i =>
        i.name.includes(kw) ||
        (i.brand || '').toLowerCase().includes(kw) ||
        (i.cat  || '').includes(kw)
      )
    }

    return { success: true, data: result, total: result.length }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── get：单条详情 + 最近20条日志 ─────────────────────
async function actionGet(openid, id) {
  try {
    const { data: ing } = await col.doc(id).get()
    if (!ing || ing._openid !== openid) {
      return { success: false, error: 'not_found' }
    }

    const { data: logList } = await logs
      .where({ ingredientId: id, _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return { success: true, data: { ...ing, logs: logList } }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── add：新增原料 ─────────────────────────────────────
async function actionAdd(openid, payload) {
  try {
    const { name, cat, emoji, brand, unit, stock, threshold, costPerUnit, barcode } = payload

    if (!name || !unit) return { success: false, error: '名称和单位不能为空' }

    const stockNum    = Number(stock)    || 0
    const threshNum   = Number(threshold)|| 0
    const now         = Date.now()

    const doc = {
      _openid:     openid,
      name,
      cat:         cat         || '其他',
      emoji:       emoji       || '🍶',
      brand:       brand       || '',
      unit,
      stock:       stockNum,
      threshold:   threshNum,
      costPerUnit: Number(costPerUnit) || 0,
      barcode:     barcode     || '',
      status:      calcStatus(stockNum, threshNum),
      createdAt:   now,
      updatedAt:   now,
    }

    const { _id } = await col.add({ data: doc })
    return { success: true, data: { _id, ...doc } }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── update：更新原料字段 ──────────────────────────────
async function actionUpdate(openid, id, payload) {
  try {
    // 鉴权：确认是自己的数据
    const { data: ing } = await col.doc(id).get()
    if (!ing || ing._openid !== openid) {
      return { success: false, error: 'forbidden' }
    }

    const allowed = ['name','cat','emoji','brand','unit','stock','threshold','costPerUnit','barcode']
    const patch   = {}
    allowed.forEach(k => { if (payload[k] !== undefined) patch[k] = payload[k] })

    // 如果更新了 stock 或 threshold，重新计算 status
    const newStock     = patch.stock     !== undefined ? Number(patch.stock)     : ing.stock
    const newThreshold = patch.threshold !== undefined ? Number(patch.threshold) : ing.threshold
    if (patch.stock     !== undefined) patch.stock     = Number(patch.stock)
    if (patch.threshold !== undefined) patch.threshold = Number(patch.threshold)
    if (patch.costPerUnit !== undefined) patch.costPerUnit = Number(patch.costPerUnit)
    patch.status    = calcStatus(newStock, newThreshold)
    patch.updatedAt = Date.now()

    await col.doc(id).update({ data: patch })
    return { success: true, data: { ...ing, ...patch } }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── remove：删除原料（级联删日志） ────────────────────
async function actionRemove(openid, id) {
  try {
    const { data: ing } = await col.doc(id).get()
    if (!ing || ing._openid !== openid) {
      return { success: false, error: 'forbidden' }
    }

    // 删除原料本体
    await col.doc(id).remove()

    // 级联删除日志（云数据库无 bulk delete，需逐条）
    const { data: logList } = await logs.where({ ingredientId: id }).limit(500).get()
    await Promise.all(logList.map(l => logs.doc(l._id).remove()))

    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── stock：出入库（核心接口）─────────────────────────
// delta > 0 = 入库，delta < 0 = 出库
async function actionStock(openid, id, payload) {
  try {
    const { delta, reason } = payload

    if (!delta || delta === 0) return { success: false, error: 'delta 不能为 0' }

    // 读取当前原料
    const { data: ing } = await col.doc(id).get()
    if (!ing || ing._openid !== openid) {
      return { success: false, error: 'not_found' }
    }

    const newStock = Math.round((ing.stock + Number(delta)) * 1000) / 1000

    // 出库检查：禁止负库存
    if (newStock < 0) {
      return {
        success: false,
        error:   'insufficient_stock',
        current: ing.stock,
        unit:    ing.unit,
      }
    }

    const newStatus = calcStatus(newStock, ing.threshold)
    const now       = Date.now()

    // ① 原子更新库存（inc 操作是原子的）
    await col.doc(id).update({
      data: {
        stock:     _.inc(Number(delta)),
        status:    newStatus,
        updatedAt: now,
      }
    })

    // ② 写入日志（云函数以 admin 身份写，前端无写权限）
    const logDoc = {
      _openid:      openid,
      ingredientId: id,
      ingredientName: ing.name,
      delta:        Number(delta),
      reason:       reason || (delta > 0 ? '手动入库' : '手动出库'),
      balance:      newStock,
      createdAt:    now,
      createdAtStr: _fmtTime(now),
    }
    const { _id: logId } = await logs.add({ data: logDoc })

    // 返回更新后的原料（重新读一次确保一致）
    const { data: updated } = await col.doc(id).get()

    return {
      success:       true,
      data:          updated,
      log:           { _id: logId, ...logDoc },
      lowStockAlert: newStatus !== 'ok' ? { status: newStatus, stock: newStock, threshold: ing.threshold, unit: ing.unit } : null,
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── logs：分页获取日志 ────────────────────────────────
async function actionLogs(openid, id, offset, limit) {
  try {
    const { data } = await logs
      .where({ ingredientId: id, _openid: openid })
      .orderBy('createdAt', 'desc')
      .skip(offset)
      .limit(Math.min(limit, 100))
      .get()

    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── barcode：条码查询 ────────────────────────────────
async function actionBarcode(openid, code) {
  try {
    if (!code) return { success: false, error: '条码不能为空' }
    const { data } = await col.where({ _openid: openid, barcode: code }).limit(1).get()
    if (!data.length) return { success: true, data: null }
    return { success: true, data: data[0] }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── migrate：本地 wx.storage 数据一次性迁移上云 ───────
async function actionMigrate(openid, payload) {
  const { ingredients = [], logs: localLogs = {} } = payload
  let imported = 0, skipped = 0, logImported = 0

  try {
    // 获取已有原料（去重用）
    const { data: existing } = await col.where({ _openid: openid }).limit(200).get()
    const existingNames = new Set(existing.map(i => i.name))

    // 老 id → 新 _id 映射（日志关联用）
    const idMap = {}
    existing.forEach(i => { if (i.legacyId) idMap[i.legacyId] = i._id })

    // 批量写入原料
    for (const ing of ingredients) {
      if (existingNames.has(ing.name)) {
        skipped++
        continue
      }
      const stockNum  = Number(ing.stock)    || 0
      const threshNum = Number(ing.threshold)|| 0
      const now       = Date.now()
      const doc = {
        _openid:     openid,
        legacyId:    ing.id,       // 保留老 id 供日志关联
        name:        ing.name,
        cat:         ing.cat         || '其他',
        emoji:       ing.emoji       || '🍶',
        brand:       ing.brand       || '',
        unit:        ing.unit,
        stock:       stockNum,
        threshold:   threshNum,
        costPerUnit: Number(ing.costPerUnit) || 0,
        barcode:     ing.barcode     || '',
        status:      calcStatus(stockNum, threshNum),
        createdAt:   now,
        updatedAt:   now,
      }
      const { _id } = await col.add({ data: doc })
      idMap[ing.id] = _id
      imported++
    }

    // 批量写入日志
    for (const [legacyId, logArr] of Object.entries(localLogs)) {
      const newIngId = idMap[legacyId]
      if (!newIngId || !Array.isArray(logArr)) continue

      for (const log of logArr) {
        await logs.add({
          data: {
            _openid:        openid,
            ingredientId:   newIngId,
            ingredientName: log.name || '',
            delta:          Number(log.delta) || 0,
            reason:         log.reason || '',
            balance:        Number(log.balance) || 0,
            createdAt:      Date.now(),
            createdAtStr:   log.time || '',
          }
        })
        logImported++
      }
    }

    return { success: true, imported, skipped, logImported }
  } catch (e) {
    return { success: false, error: e.message, imported, skipped }
  }
}

// ── 格式化时间 ────────────────────────────────────────
function _fmtTime(ts) {
  const d  = new Date(ts)
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}
