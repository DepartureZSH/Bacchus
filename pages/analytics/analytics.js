// pages/analytics/analytics.js
// Phase 3：接入 analytics 云函数，删除全部 MOCK 数据

const app = getApp()

// 空态占位数据（无真实数据时使用）
const EMPTY_TREND = {
  week:  { labels:['周一','周二','周三','周四','周五','周六','周日'], revenue:[0,0,0,0,0,0,0], profit:[0,0,0,0,0,0,0] },
  month: { labels:['第1周','第2周','第3周','第4周'], revenue:[0,0,0,0], profit:[0,0,0,0] },
}
const EMPTY_KPI = {
  revenue:'0', profit:'0', margin:0, cups:0, avgOrder:0,
  materialCost:'0', costRate:0, revenueTrendUp:true, revenueTrend:'暂无数据',
}

Page({
  data: {
    periods:       [{ val:'week', label:'本周' }, { val:'month', label:'本月' }],
    currentPeriod: 'week',
    isLoading:     false,
    isEmpty:       false,   // 是否无真实数据
    kpi:           { ...EMPTY_KPI },
    topIngredients:[],

    stockDist:     null,
    chartW: 300,
    lineH:  160,
    barH:   150,
  },

  _lineCanvas: null,
  _barCanvas:  null,
  _dpr:        1,
  _trendData:  { week: EMPTY_TREND.week, month: EMPTY_TREND.month },
  _stockDist:  null,

  onLoad() {
    const sys   = wx.getSystemInfoSync()
    const ratio = sys.screenWidth / 750
    const chartW = Math.floor(sys.screenWidth - 112 * ratio)
    const lineH  = Math.floor(320 * ratio)
    const barH   = Math.floor(300 * ratio)
    this._dpr    = sys.pixelRatio || 2
    this.setData({ chartW, lineH, barH })
  },

  onReady() {
    this._initCanvases(() => {
      this._canvasReady = true
      const defaultDist = { labels:['正常','偏低','告急'], values:[0,0,0], colors:['#4caf84','#c9a96e','#e05c5c'] }
      this._drawLine(this._trendData[this.data.currentPeriod])
      this._drawBar(this._stockDist || defaultDist)
    })
    this._loadData()
    const s = getApp().globalData.shopInfo
    this.setData({ isPro: s.plan === 'pro' || s.plan === 'Pro' })
  },

  onShow() {
    // onReady 之后才有 canvas，避免首次进入重复请求
    if (this._canvasReady) this._loadData()
  },

  // ── 加载云端数据 ──────────────────────────────────────
  _loadData() {
    if (app.globalData.isOffline) return
    this.setData({ isLoading: true })

    const period = this.data.currentPeriod
    wx.cloud.callFunction({
      name: 'analytics',
      data: { action: 'summary', period },
    }).then(res => {
      const r = res.result || {}
      this.setData({ isLoading: false })
      if (!r.success) {
        wx.showToast({ title: '数据加载失败', icon: 'none' })
        return
      }

      this.setData({
        isEmpty:        r.isEmpty,
        kpi:            r.isEmpty ? { ...EMPTY_KPI } : r.kpi,
        topIngredients: r.topIngredients || [],
        stockDist:      r.stockDist || null,
      })

      // 缓存趋势数据
      if (r.trend) {
        this._trendData[period] = r.trend
      }
      this._stockDist = r.stockDist

      // 重绘 canvas
      if (this._lineCanvas) this._drawLine(this._trendData[period])
      const dist = r.stockDist || { labels:['正常','偏低','告急'], values:[0,0,0], colors:['#4caf84','#c9a96e','#e05c5c'] }
      if (this._barCanvas) this._drawBar(dist)

    }).catch(() => {
      this.setData({ isLoading: false })
    })
  },

  onPeriod(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ currentPeriod: val, kpi: EMPTY_KPI, isLoading: true })

    wx.cloud.callFunction({
      name: 'analytics',
      data: { action: 'summary', period: val },
    }).then(res => {
      const r = res.result || {}
      this.setData({ isLoading: false })
      if (!r.success) return
      this.setData({ isEmpty: r.isEmpty, kpi: r.isEmpty ? EMPTY_KPI : r.kpi })
      if (r.trend) {
        this._trendData[val] = r.trend
        if (this._lineCanvas) this._drawLine(r.trend)
      }
    }).catch(() => this.setData({ isLoading: false }))
  },

  // ── AI 经营建议（Pro 专属）────────────────────────────
  onAIAdvice() {
    if (!this.data.isPro) {
      wx.showModal({
        title: 'Pro 专属功能',
        content: 'AI 经营建议是 Pro 版专属功能，升级后每天可获取 3 次 AI 智能分析。',
        confirmText: '去升级',
        success: (res) => { if (res.confirm) wx.navigateTo({ url: '/pages/subscription/subscription' }) }
      })
      return
    }
    this._loadAIAdvice(false)
  },

  onRefreshAdvice() { this._loadAIAdvice(true) },

  _loadAIAdvice(forceRefresh) {
    if (this.data.aiAdviceLoading) return
    if (getApp().globalData.isOffline) {
      wx.showToast({ title: '离线模式无法获取 AI 建议', icon: 'none' })
      return
    }
    this.setData({ aiAdviceLoading: true, aiAdviceError: '' })

    wx.cloud.callFunction({
      name: 'analytics',
      data: { action: 'aiAdvice', period: this.data.currentPeriod, forceRefresh },
    }).then(res => {
      const r = res.result || {}
      this.setData({ aiAdviceLoading: false })

      if (r.success && r.advice) {
        this.setData({ aiAdvice: r.advice })
      } else if (r.error === 'pro_required') {
        this.setData({ aiAdviceError: '此功能需要 Pro 版' })
      } else if (r.error === 'daily_limit') {
        this.setData({ aiAdviceError: `今日 AI 建议已用完（${r.limit}次/天），明天再来` })
      } else if (r.error === 'ai_failed' || !r.advice) {
        this.setData({ aiAdviceError: 'AI 分析失败，请稍后重试' })
      }
    }).catch(() => {
      this.setData({ aiAdviceLoading: false, aiAdviceError: '网络异常，请重试' })
    })
  },

  // ── canvas 初始化 ───────────────────────────────────────
  _initCanvases(cb) {
    const query = wx.createSelectorQuery().in(this)
    query.select('#lineChart').fields({ node: true, size: true })
    query.select('#barChart').fields({ node: true, size: true })
    query.exec(res => {
      if (!res[0]?.node || !res[1]?.node) {
        setTimeout(() => this._initCanvases(cb), 100)
        return
      }
      const dpr = this._dpr
      const { chartW, lineH, barH } = this.data
      const lc = res[0].node
      lc.width = chartW * dpr; lc.height = lineH * dpr
      this._lineCanvas = lc
      const bc = res[1].node
      bc.width = chartW * dpr; bc.height = barH * dpr
      this._barCanvas = bc
      if (cb) cb()
    })
  },

  _drawLine(data) {
    if (!this._lineCanvas) return
    const ctx = this._lineCanvas.getContext('2d')
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    drawLineChart(ctx, this.data.chartW, this.data.lineH, data)
  },

  _drawBar(data) {
    if (!this._barCanvas) return
    const ctx = this._barCanvas.getContext('2d')
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    drawBarChart(ctx, this.data.chartW, this.data.barH, data)
  },
})

// ══════════════════════════════════════════════
// 绘图函数（与原版完全一致，无 MOCK 数据）
// ══════════════════════════════════════════════

function drawLineChart(ctx, W, H, data) {
  const PAD = { top:20, right:16, bottom:36, left:46 }
  const cW  = W - PAD.left - PAD.right
  const cH  = H - PAD.top  - PAD.bottom
  const n   = data.labels.length
  const max = Math.max(...data.revenue, ...data.profit, 1) * 1.15
  const fs  = Math.max(10, Math.round(W * 0.034))

  function toX(i) { return PAD.left + (i / Math.max(n - 1, 1)) * cW }
  function toY(v) { return PAD.top  + cH * (1 - v / max) }

  ctx.fillStyle = '#16181f'
  ctx.fillRect(0, 0, W, H)

  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (cH / 4) * i
    ctx.strokeStyle = '#2a2d38'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
    const v = Math.round(max * (1 - i / 4))
    ctx.fillStyle = '#5c5b65'; ctx.font = `${fs}px sans-serif`
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(v >= 1000 ? (v/1000).toFixed(1)+'k' : String(v), PAD.left - 6, y)
  }

  function drawOneLine(vals, lineColor, gradColor) {
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH)
    grad.addColorStop(0, gradColor); grad.addColorStop(1, 'rgba(22,24,31,0)')
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(vals[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(vals[i]))
    ctx.lineTo(toX(n-1), PAD.top+cH); ctx.lineTo(toX(0), PAD.top+cH)
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath(); ctx.moveTo(toX(0), toY(vals[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(vals[i]))
    ctx.strokeStyle = lineColor; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke()
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(toX(i), toY(vals[i]), 4, 0, Math.PI*2)
      ctx.fillStyle = lineColor; ctx.fill()
      ctx.strokeStyle = '#16181f'; ctx.lineWidth = 2; ctx.stroke()
    }
  }

  drawOneLine(data.profit,  '#4caf84', 'rgba(76,175,132,0.20)')
  drawOneLine(data.revenue, '#c9a96e', 'rgba(201,169,110,0.20)')

  ctx.fillStyle = '#5c5b65'; ctx.font = `${fs}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  for (let i = 0; i < n; i++) ctx.fillText(data.labels[i], toX(i), H - 6)
}

function drawBarChart(ctx, W, H, data) {
  const PAD  = { top:28, right:16, bottom:40, left:46 }
  const cW   = W - PAD.left - PAD.right
  const cH   = H - PAD.top  - PAD.bottom
  const n    = data.labels.length
  const max  = Math.max(...data.values, 1)
  const gap  = Math.round(cW * 0.06)
  const barW = (cW - gap * (n - 1)) / n
  const r    = 5
  const fs   = Math.max(10, Math.round(W * 0.034))

  ctx.fillStyle = '#16181f'; ctx.fillRect(0, 0, W, H)

  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (cH / 4) * i
    ctx.strokeStyle = '#2a2d38'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
    ctx.fillStyle = '#5c5b65'; ctx.font = `${fs}px sans-serif`
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(Math.round(max * (1 - i/4)) + '%', PAD.left - 6, y)
  }

  for (let i = 0; i < n; i++) {
    const x  = PAD.left + i * (barW + gap)
    const bH = (data.values[i] / max) * cH
    const y  = PAD.top + cH - bH
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + barW - r, y)
    ctx.arcTo(x + barW, y, x + barW, y + r, r)
    ctx.lineTo(x + barW, y + bH); ctx.lineTo(x, y + bH)
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath(); ctx.fillStyle = data.colors[i]; ctx.fill()
    ctx.fillStyle = '#f0ede8'; ctx.font = `bold ${Math.round(fs*1.1)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.fillText(data.values[i] + '%', x + barW/2, y - 6)
    ctx.fillStyle = '#9a98a0'; ctx.font = `${fs}px sans-serif`
    ctx.fillText(data.labels[i], x + barW/2, H - 8)
  }
}
