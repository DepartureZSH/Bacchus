// pages/subscription/subscription.js
// Phase 4：接入 shops 云函数订阅管理

const app = getApp()

const PLANS = [
  { id:'monthly',   name:'月度套餐', price:39,  origPrice:39,  period:'月', tag:'',       saving:null, days:30  },
  { id:'quarterly', name:'季度套餐', price:99,  origPrice:117, period:'季', tag:'推荐',   saving:18,   days:90  },
  { id:'yearly',    name:'年度套餐', price:299, origPrice:468, period:'年', tag:'最划算', saving:169,  days:365 },
]

const FEATURES = [
  { name:'AI 酒单生成',   hint:'每月可生成次数',     free:'10次/月',  pro:'无限次'  },
  { name:'AI 经营建议',   hint:'Pro 专属智能分析',   free:'✗',        pro:'3次/天'  },
  { name:'原料库存管理',  hint:null,                 free:'✓',        pro:'✓'       },
  { name:'扫码录入',      hint:null,                 free:'✓',        pro:'✓'       },
  { name:'采购清单',      hint:null,                 free:'✓',        pro:'✓'       },
  { name:'经营分析',      hint:'销售趋势+原料排行',  free:'基础版',   pro:'完整版'  },
  { name:'配方库',        hint:null,                 free:'✓',        pro:'✓'       },
  { name:'云端备份同步',  hint:'多设备数据同步',     free:'✗',        pro:'✓'       },
  { name:'多店管理',      hint:null,                 free:'✗',        pro:'即将'    },
  { name:'客服优先响应',  hint:null,                 free:'✗',        pro:'✓'       },
]

const FAQS = [
  { id:1, q:'订阅可以随时取消吗？',
    a:'可以。取消后当前计费周期仍可使用 Pro 功能，到期后自动降回 Free 版，不再扣费。' },
  { id:2, q:'数据会在降级后丢失吗？',
    a:'不会。降级为 Free 版后，所有库存数据保留完整，云端备份记录保留 90 天。' },
  { id:3, q:'首月 5 折怎么计算？',
    a:'月度套餐原价 ¥39，首月仅 ¥19.5；从第二个月起恢复原价。优惠仅限新用户首次订阅。' },
  { id:4, q:'支持开发票吗？',
    a:'支持电子发票，订阅后在账户设置中申请，5 个工作日内发送至注册邮箱。' },
]

Page({
  data: {
    isPro:          false,
    isAutoRenew:    false,
    shopInfo:       {},
    expiryPct:      0,
    usedDays:       0,
    totalDays:      30,
    daysLeft:       0,
    aiUsed:         0,
    aiQuotaLimit:   10,
    aiQuotaRemain:  10,
    monthlyPrice:   39,
    features:       FEATURES,
    plans:          PLANS,
    selectedPlan:   'quarterly',
    selectedPlanObj: PLANS[1],
    faqs:           FAQS,
    expandedFaq:    null,
    isSubscribing:  false,   // 防止重复点击
    isCancelling:   false,
    isOffline:      false,
  },

  onLoad() { this._init() },
  onShow()  { this._init() },

  _init() {
    const s      = app.globalData.shopInfo
    const isOff  = app.globalData.isOffline
    const isPro  = s.plan === 'pro' || s.plan === 'Pro'
    this.setData({ isOffline: isOff })

    // 计算有效期进度（本地缓存先显示）
    let expiryPct = 0, usedDays = 0, totalDays = 30, daysLeft = 0
    if (isPro && s.planExpiry) {
      const expiry    = new Date(s.planExpiry)
      const now       = new Date()
      const start     = new Date(now.getFullYear(), now.getMonth(), 1)
      totalDays  = Math.max(1, Math.round((expiry - start) / 86400000))
      usedDays   = Math.max(0, Math.round((now - start) / 86400000))
      daysLeft   = Math.max(0, Math.ceil((expiry - now) / 86400000))
      expiryPct  = Math.max(5, Math.min(95, Math.round((usedDays / totalDays) * 100)))
    }
    this.setData({ isPro, isAutoRenew: s.planAutoRenew || false, shopInfo: s, expiryPct, usedDays, totalDays, daysLeft })

    if (isOff) return

    // 从云端拉取精确配额和订阅状态
    Promise.all([
      wx.cloud.callFunction({ name:'ai-menu', data:{ action:'quota' } }),
      wx.cloud.callFunction({ name:'shops',   data:{ action:'get'   } }),
    ]).then(([quotaRes, shopRes]) => {
      const q = quotaRes.result || {}
      if (q.success) {
        this.setData({
          aiUsed:       q.quotaUsed || 0,
          aiQuotaLimit: q.quotaLimit != null ? q.quotaLimit : 10,
          aiQuotaRemain:q.quotaRemaining != null ? q.quotaRemaining : 10,
        })
      }
      const sr = shopRes.result || {}
      if (sr.success) {
        const si = sr.shopInfo
        // 更新全局缓存
        app.globalData.shopInfo = { ...app.globalData.shopInfo, ...si }
        wx.setStorageSync('bacchus_shopInfo', app.globalData.shopInfo)

        const isPro2 = si.plan === 'pro'
        let expiryPct2 = 0, usedDays2 = 0, totalDays2 = 30, daysLeft2 = 0
        if (isPro2 && si.planExpiry) {
          const expiry = new Date(si.planExpiry)
          const now    = new Date()
          const start  = new Date(now.getFullYear(), now.getMonth(), 1)
          totalDays2 = Math.max(1, Math.round((expiry - start) / 86400000))
          usedDays2  = Math.max(0, Math.round((now - start) / 86400000))
          daysLeft2  = Math.max(0, Math.ceil((expiry - now) / 86400000))
          expiryPct2 = Math.max(5, Math.min(95, Math.round((usedDays2 / totalDays2) * 100)))
        }
        this.setData({
          isPro: isPro2, shopInfo: si,
          isAutoRenew: si.planAutoRenew || false,
          expiryPct: expiryPct2, usedDays: usedDays2, totalDays: totalDays2, daysLeft: daysLeft2,
        })
      }
    }).catch(() => {})
  },

  onSelectPlan(e) {
    const id   = e.currentTarget.dataset.id
    const plan = PLANS.find(p => p.id === id)
    if (plan) this.setData({ selectedPlan: id, selectedPlanObj: plan })
  },

  // ── 订阅（Mock 支付 → 云函数写库）─────────────────────
  onSubscribe() {
    if (this.data.isSubscribing || this.data.isOffline) {
      if (this.data.isOffline) wx.showToast({ title:'请联网后再操作', icon:'none' })
      return
    }
    const plan = this.data.selectedPlanObj
    wx.showModal({
      title:       `订阅 Pro ${plan.name}`,
      content:     `¥${plan.price}/${plan.period}，首月享 5 折优惠\n\n` +
                   `⚠ 演示模式：点确认直接升级（正式版需接入微信支付）`,
      confirmText: '确认订阅',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ isSubscribing: true })
        wx.showLoading({ title: '处理中…', mask: true })

        try {
          // ── 正式版：先调起微信支付获取 prepay_id ─────────
          // const payToken = await this._requestWxPay(plan)
          // ── Demo：直接用 mock token ───────────────────────
          const payToken = 'mock'

          const res2 = await wx.cloud.callFunction({
            name: 'shops',
            data: { action:'subscribe', payload:{ planId: plan.id, paymentToken: payToken } },
          })
          const r = res2.result || {}
          wx.hideLoading()

          if (r.success) {
            // 更新本地缓存
            app.globalData.shopInfo.plan       = 'pro'
            app.globalData.shopInfo.planExpiry = r.planExpiry
            wx.setStorageSync('bacchus_shopInfo', app.globalData.shopInfo)
            wx.showToast({ title: `已升级 Pro ✦ (${r.daysAdded}天)`, icon:'success', duration:2500 })
            setTimeout(() => this._init(), 600)
          } else {
            wx.showToast({ title: r.error || '订阅失败，请重试', icon:'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '网络异常，请重试', icon:'none' })
        } finally {
          this.setData({ isSubscribing: false })
        }
      }
    })
  },

  // ── 续费（Pro 用户续期）─────────────────────────────────
  onRenew() {
    if (this.data.isOffline) { wx.showToast({ title:'请联网后再操作', icon:'none' }); return }
    // 跳转到套餐选择（复用订阅流程）
    this.setData({ isPro: false })  // 临时展示套餐列表，renew 完再 _init
    wx.showModal({
      title:   '选择续费套餐',
      content: `当前套餐剩余 ${this.data.daysLeft} 天，续费可叠加有效期。`,
      confirmText: '去选择',
      success: (res) => {
        if (!res.confirm) this.setData({ isPro: true })
        // 直接停留在当前页选套餐
      }
    })
  },

  // ── 取消自动续订 ─────────────────────────────────────────
  onCancelSub() {
    if (this.data.isCancelling || this.data.isOffline) {
      if (this.data.isOffline) wx.showToast({ title:'请联网后再操作', icon:'none' })
      return
    }
    wx.showModal({
      title:        '取消续订',
      content:      `取消后，当前套餐到期（${this.data.shopInfo.planExpiry}）后将降回 Free 版。\n\n数据不会丢失。`,
      confirmText:  '确认取消',
      confirmColor: '#e05c5c',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ isCancelling: true })
        try {
          const res2 = await wx.cloud.callFunction({ name:'shops', data:{ action:'cancelSub' } })
          if (res2.result && res2.result.success) {
            app.globalData.shopInfo.planAutoRenew = false
            wx.setStorageSync('bacchus_shopInfo', app.globalData.shopInfo)
            wx.showToast({ title:'已取消续订', icon:'none', duration:2000 })
            this._init()
          } else {
            wx.showToast({ title:'操作失败，请重试', icon:'none' })
          }
        } catch (_) {
          wx.showToast({ title:'网络异常', icon:'none' })
        } finally {
          this.setData({ isCancelling: false })
        }
      }
    })
  },

  onFaq(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedFaq: this.data.expandedFaq === id ? null : id })
  },

  // ── 预留：真实微信支付 ────────────────────────────────────
  // async _requestWxPay(plan) {
  //   const payRes = await wx.cloud.callFunction({
  //     name: 'shops',
  //     data: { action: 'createPayOrder', payload: { planId: plan.id } }
  //   })
  //   const { prepayId, ...signParams } = payRes.result
  //   await wx.requestPayment({ ...signParams, package: prepayId })
  //   return prepayId
  // },
})
