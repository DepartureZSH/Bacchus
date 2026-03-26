// cloudfunctions/shops/index.js
// 云函数：shops
// 处理：登录建档 / 获取店铺信息 / 更新店铺 / 更新单位设置

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db  = cloud.database()
const col = db.collection('shops')

// ── 计算订阅状态 ──────────────────────────────────────
function calcPlanStatus(shop) {
  if (shop.plan !== 'pro') return { plan: 'free', isExpired: false, daysLeft: null }
  if (!shop.planExpiry)    return { plan: 'pro',  isExpired: false, daysLeft: null }
  const now      = Date.now()
  const expiry   = new Date(shop.planExpiry).getTime()
  const daysLeft = Math.ceil((expiry - now) / 86400000)
  return { plan: 'pro', isExpired: daysLeft <= 0, daysLeft: Math.max(0, daysLeft) }
}

// ── 主入口 ────────────────────────────────────────────
exports.main = async (event) => {
  const { OPENID } = await cloud.getWXContext()
  const { action, payload = {} } = event

  switch (action) {
    case 'init':        return await actionInit(OPENID, payload)
    case 'get':         return await actionGet(OPENID)
    case 'update':      return await actionUpdate(OPENID, payload)
    case 'updateUnits': return await actionUpdateUnits(OPENID, payload)
    case 'subscribe':   return await actionSubscribe(OPENID, payload)
    case 'cancelSub':   return await actionCancelSub(OPENID)
    case 'restoreSub':  return await actionRestoreSub(OPENID)
    default:
      return { success: false, error: 'unknown_action' }
  }
}

// ── init：首次登录建档，已有则直接返回 ──────────────────
async function actionInit(openid, payload) {
  try {
    // 查找已有店铺
    const { data } = await col.where({ _openid: openid }).limit(1).get()

    if (data.length > 0) {
      const shop = data[0]
      return {
        success:   true,
        isNew:     false,
        shopId:    shop._id,
        shopInfo:  { ...shop, ...calcPlanStatus(shop) },
      }
    }

    // 新用户：创建默认店铺
    const now = Date.now()
    const defaultShop = {
      _openid:       openid,
      name:          payload.shopName || '我的酒吧',
      city:          '',
      address:       '',
      phone:         '',
      plan:          'free',
      planExpiry:    null,
      planAutoRenew: false,
      aiQuotaUsed:   0,
      aiQuotaReset:  now,
      unitSettings: {
        volume:   'ml',
        weight:   'g',
        currency: '¥',
      },
      createdAt: now,
      updatedAt: now,
    }

    const { _id } = await col.add({ data: defaultShop })

    return {
      success:  true,
      isNew:    true,
      shopId:   _id,
      shopInfo: { _id, ...defaultShop, plan: 'free', isExpired: false, daysLeft: null },
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── get：获取当前用户的店铺信息 ──────────────────────────
async function actionGet(openid) {
  try {
    const { data } = await col.where({ _openid: openid }).limit(1).get()
    if (!data.length) return { success: false, error: 'shop_not_found' }
    const shop = data[0]
    return { success: true, shopInfo: { ...shop, ...calcPlanStatus(shop) } }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── update：更新店铺基本信息 ─────────────────────────────
async function actionUpdate(openid, payload) {
  try {
    const { data } = await col.where({ _openid: openid }).limit(1).get()
    if (!data.length) return { success: false, error: 'shop_not_found' }

    const allowed = ['name', 'city', 'address', 'phone']
    const patch   = {}
    allowed.forEach(k => { if (payload[k] !== undefined) patch[k] = payload[k] })
    patch.updatedAt = Date.now()

    await col.doc(data[0]._id).update({ data: patch })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── updateUnits：更新单位设置 ────────────────────────────
async function actionUpdateUnits(openid, payload) {
  try {
    const { data } = await col.where({ _openid: openid }).limit(1).get()
    if (!data.length) return { success: false, error: 'shop_not_found' }

    const allowed = ['volume', 'weight', 'currency']
    const units   = {}
    allowed.forEach(k => { if (payload[k] !== undefined) units[k] = payload[k] })

    await col.doc(data[0]._id).update({
      data: { unitSettings: units, updatedAt: Date.now() }
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
// ── subscribe：订阅升级 Pro ─────────────────────────────────
// 微信支付暂用 Mock 模式（真实支付需接入微信支付商户号）
// paymentToken: 前端传入支付凭证（真实支付时为 wx.requestPayment 成功后的 prepay_id）
async function actionSubscribe(openid, payload) {
  try {
    const { planId = 'monthly', paymentToken = 'mock' } = payload

    // 计划配置
    const PLAN_CONFIG = {
      monthly:   { days: 30,  price: 39  },
      quarterly: { days: 90,  price: 99  },
      yearly:    { days: 365, price: 299 },
    }
    const plan = PLAN_CONFIG[planId]
    if (!plan) return { success: false, error: 'invalid_plan' }

    // ── 真实支付校验（生产环境）────────────────────────────
    // 当 paymentToken !== 'mock' 时，调用微信支付订单查询接口验证
    // 这里预留接口，实际接入时替换下方 mock 逻辑
    if (paymentToken !== 'mock') {
      // TODO: 调用 wx.pay.queryOrder 验证支付状态
      // const payResult = await verifyWxPayment(paymentToken)
      // if (!payResult.success) return { success: false, error: 'payment_verify_failed' }
      console.log('[subscribe] payment token received:', paymentToken.slice(0, 20) + '...')
    }

    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop = shops[0]

    // 计算到期时间（续订叠加）
    const now = Date.now()
    const existingExpiry = (shop.plan === 'pro' && shop.planExpiryTs)
      ? Math.max(shop.planExpiryTs, now)
      : now
    const newExpiryTs = existingExpiry + plan.days * 86400000
    const newExpiry   = _fmtDate(newExpiryTs)

    await col.doc(shop._id).update({
      data: {
        plan:           'pro',
        planId,
        planExpiry:     newExpiry,
        planExpiryTs:   newExpiryTs,
        planAutoRenew:  true,
        planUpdatedAt:  now,
        updatedAt:      now,
      }
    })

    return {
      success:    true,
      plan:       'pro',
      planId,
      planExpiry: newExpiry,
      daysAdded:  plan.days,
    }
  } catch (e) {
    console.error('[subscribe]', e)
    return { success: false, error: e.message }
  }
}

// ── cancelSub：取消自动续订 ───────────────────────────────
async function actionCancelSub(openid) {
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    await col.doc(shops[0]._id).update({
      data: { planAutoRenew: false, updatedAt: Date.now() }
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── restoreSub：到期自动降回 Free（定时触发器调用）─────────
async function actionRestoreSub(openid) {
  try {
    const { data: shops } = await col.where({ _openid: openid }).limit(1).get()
    if (!shops.length) return { success: false, error: 'shop_not_found' }
    const shop = shops[0]
    if (shop.plan !== 'pro') return { success: true, action: 'no_op' }
    const now = Date.now()
    if (shop.planExpiryTs && shop.planExpiryTs > now) {
      return { success: true, action: 'still_valid', daysLeft: Math.ceil((shop.planExpiryTs - now) / 86400000) }
    }
    await col.doc(shop._id).update({
      data: { plan: 'free', planAutoRenew: false, updatedAt: now }
    })
    return { success: true, action: 'downgraded' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

function _fmtDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
