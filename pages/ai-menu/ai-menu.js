// pages/ai-menu/ai-menu.js
// 重构：AI酒单 + AI营销双Tab

const app = getApp()
const RDB = require('../../data/myRecipes')
const DB  = require('../../data/ingredients')

// ── 常量 ────────────────────────────────────────────────────
const IMG_STYLES = [
  { id:'elegant',    label:'精致暗调', emoji:'🥃', desc:'高级感暗调' },
  { id:'bright',     label:'清新明亮', emoji:'☀️', desc:'Instagram 风' },
  { id:'vintage',    label:'复古胶片', emoji:'📷', desc:'70年代风格' },
  { id:'minimal',    label:'极简白底', emoji:'⬜', desc:'菜单卡片风' },
  { id:'neon',       label:'霓虹夜店', emoji:'🌈', desc:'赛博朋克' },
  { id:'watercolor', label:'水彩插画', emoji:'🎨', desc:'艺术插画风' },
]
const POSTER_STYLES = [
  { id:'luxury',  label:'奢华金黑', emoji:'🖤', desc:'高端夜店风' },
  { id:'garden',  label:'花园清新', emoji:'🌿', desc:'夏日户外风' },
  { id:'retro',   label:'复古海报', emoji:'🎞', desc:'70年代美式' },
  { id:'minimal', label:'极简白',   emoji:'⬜', desc:'简约菜单风' },
  { id:'neon',    label:'霓虹赛博', emoji:'🌈', desc:'夜店赛博风' },
]
const MKTG_TYPES = [
  { id:'cover',  label:'单品图',  emoji:'🍸', desc:'1:1 配方展示图' },
  { id:'poster', label:'海报',    emoji:'🎭', desc:'3:4 竖版海报' },
  { id:'menu',   label:'酒单图',  emoji:'📋', desc:'3:4 文字酒单' },
]
const RECIPE_FILTERS = [
  { id:'all',   label:'全部' },
  { id:'金酒',  label:'金酒' },
  { id:'伏特加', label:'伏特加' },
  { id:'朗姆酒', label:'朗姆酒' },
  { id:'龙舌兰', label:'龙舌兰' },
  { id:'威士忌', label:'威士忌' },
  { id:'白兰地', label:'白兰地' },
]
const COLL_FILTERS = [
  { id:'all',    label:'全部' },
  { id:'small',  label:'≤3款' },
  { id:'medium', label:'4-9款' },
  { id:'large',  label:'10款+' },
]

function calcSuggestQty(stock, threshold) { return Math.max(0, threshold * 2 - stock) }
function _parseIngAmount(str) {
  const n = parseFloat(str || '0')
  return isNaN(n) || n <= 0 ? 1 : n
}
function _parseIngUnit(str) {
  return (str || '').replace(/^[\d.]+\s*/, '').trim() || '-'
}
function purchNowStr() {
  const d = new Date()
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
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
    // ── Tab ─────────────────────────────────────────────────
    activeTab: 'menu',   // 'menu' | 'mktg'

    // ══ Tab1: AI酒单 ════════════════════════════════════════
    menuGoals:      [],
    flavors:        [],
    selectedGoal:   '',
    selectedFlavor: '',
    isLoading:      false,
    loadingDots:    '',
    loadingMsg:     '正在生成',
    menuItems:      [],
    hasGenerated:   false,
    quotaUsed:      0,
    quotaRemaining: 10,
    quotaLimit:     10,
    isPro:          false,
    fromCache:      false,
    menuCustomPrompt: '',

    // ══ Tab2: AI营销 ════════════════════════════════════════
    mktgMode:     'recipe',   // 'recipe' | 'collection'

    // 可选列表
    recipeList:         [],
    recipeListFiltered: [],
    collList:           [],
    collListFiltered:   [],
    listLoading:        false,

    // 筛选 & 搜索
    recipeFilters: RECIPE_FILTERS,
    recipeSearch:  '',
    recipeFilter:  'all',
    collFilters:   COLL_FILTERS,
    collSearch:    '',
    collFilter:    'all',

    // 选中目标
    selectedRecipe: null,   // {id, name, emoji, ingredients[], desc}
    selectedColl:   null,   // {id, name, emoji, desc, recipes[]}

    // 营销图类型（合集模式）
    mktgTypes:     MKTG_TYPES,
    mktgType:      'cover',

    // 图片风格
    imgStyles:     IMG_STYLES,
    posterStyles:  POSTER_STYLES,
    imgStyle:      'elegant',
    posterStyle:   'luxury',
    customPrompt:  '',

    // 生成状态
    mktgState:    'idle',   // idle | loading | error
    mktgLoadStep: '正在生成描述词…',
    mktgError:    '',

    // Canvas 文字排版（海报/酒单模式，传给 ai-edit 用）
    canvasLayout: {
      shopName:  '',
      headline:  '',
      subline:   '',
      cocktails: [],
    },

    // ══ Tab3: AI采购 ════════════════════════════════════════
    purchMode:           'stock',  // 'stock' | 'coll'
    purchCollList:       [],
    purchSelectedCollId:   '',
    purchSelectedCollName: '',
    purchAllItems:      [],
    purchFilteredItems: [],
    purchCheckedItems:  [],
    purchCurrentSource: 'all',
    purchShowChecked:   false,
    purchTotalItems:    0,
    purchUrgentItems:   0,
    purchTotalCost:     '0',
    purchGenTime:       '',
    purchSourceFilters: [],
    purchHasMenuGaps:        false,
    purchLoading:            false,
    purchShoppingListCount:  0,
    purchItemsInList:        {},   // { [name]: true }

    // ══ Tab4: 经营分析 ════════════════════════════════════════
    analPeriods:         [{ val:'week', label:'本周' }, { val:'month', label:'本月' }],
    analCurrentPeriod:   'week',
    analIsLoading:       false,
    analIsEmpty:         false,
    analKpi:             { revenue:'0', profit:'0', margin:0, cups:0, avgOrder:0, materialCost:'0', costRate:0, revenueTrendUp:true, revenueTrend:'暂无数据' },
    analTopIngredients:  [],
    analStockDist:       null,
    analChartW:          300,
    analLineH:           160,
    analBarH:            150,
    analAiAdvice:        [],
    analAiAdviceLoading: false,
    analAiAdviceError:   '',
    analIsPro:           false,
  },

  // ── 内部状态 ─────────────────────────────────────────────
  _dotTimer:  null,
  _pollTimer: null,
  _pollCount: 0,
  _analyticsCanvasReady: false,
  _analyticsLineCanvas:  null,
  _analyticsBarCanvas:   null,
  _analyticsDpr:         1,
  _analyticsTrendData:   null,
  _analyticsStockDist:   null,

  // ── 生命周期 ─────────────────────────────────────────────
  onLoad(options)   {
    this._analyticsTrendData = { week: EMPTY_TREND.week, month: EMPTY_TREND.month }
    const tab = options && options.tab
    if (tab === 'purchase' || tab === 'analytics' || tab === 'mktg' || tab === 'menu') {
      this.setData({ activeTab: tab })
    }
    this._loadQuota()
    this._loadMenuConfig()
    this._loadLists()
    if (this.data.activeTab === 'purchase') {
      this._purchLoadCollList()
      this._purchGenerate()
    }
  },
  onShow()   {
    this._loadQuota()
    if (this.data.activeTab === 'analytics' && this._analyticsCanvasReady) this._analyticsLoadData()
  },
  onUnload() { this._stopLoading() },

  // ── Tab 切换 ─────────────────────────────────────────────
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'mktg')      this._loadLists()
    if (tab === 'purchase')  { this._purchLoadCollList(); this._purchLoadListState(); if (this.data.purchMode === 'stock') this._purchGenerate() }
    if (tab === 'analytics') this._analyticsOnTabEnter()
  },

  // ════════════════════════════════════════════════════════
  // Step 2: 数据加载
  // ════════════════════════════════════════════════════════

  _loadMenuConfig() {
    wx.cloud.callFunction({ name: 'ai-menu', data: { action: 'getConfig' } })
      .then(res => {
        const r = res.result || {}
        if (!r.success) return
        const goals   = r.goals   || []
        const flavors = r.flavors || []
        this.setData({
          menuGoals:    goals,
          flavors:      flavors,
          selectedGoal:   goals[0]   ? goals[0].id   : '',
          selectedFlavor: flavors[0] ? flavors[0].id : '',
        })
      }).catch(() => {})
  },

  _loadQuota() {
    const plan = (app.globalData.shopInfo && app.globalData.shopInfo.plan) || 'free'
    this.setData({ isPro: plan === 'pro' || plan === 'Pro' })
    if (app.globalData.isOffline) return
    wx.cloud.callFunction({ name: 'ai-menu', data: { action: 'quota' } })
      .then(res => {
        const r = res.result || {}
        if (r.success) {
          this.setData({
            quotaUsed:      r.quotaUsed      || 0,
            quotaRemaining: r.quotaRemaining != null ? r.quotaRemaining : 10,
            quotaLimit:     r.quotaLimit     != null ? r.quotaLimit     : 10,
            isPro:          r.plan === 'pro',
          })
        }
      }).catch(() => {})
  },

  // 加载「我的配方」和「我的合集」列表（营销 Tab 用）
  _loadLists() {
    if (this.data.listLoading) return
    this.setData({ listLoading: true })
    RDB.preload().then(() => {
      const myAll   = RDB.getMyAll()
      const collAll = RDB.getCollAll()

      const recipeList = myAll.map(r => ({
        id:          r._id || r.id,
        name:        r.name,
        emoji:       r.emoji || '🍹',
        coverTempUrl:r.coverTempUrl || '',
        desc:        r.desc || '',
        base:        r.base || '',
        ingredients: r.ingredients || [],
        steps:       r.steps || [],
        notes:       r.notes || '',
      }))

      const collList = collAll.map(c => ({
        id:          c._id || c.id,
        name:        c.name,
        emoji:       c.emoji || '📂',
        desc:        c.desc || '',
        coverTempUrl:c.coverTempUrl || '',
        count:       c.count || 0,
        recipes:     (c.recipes || []).slice(0, 6).map(r => ({
          id:    r._id || r.id,
          name:  r.name,
          emoji: r.emoji || '🍹',
        })),
      }))

      this.setData({ recipeList, collList, listLoading: false }, () => {
        this._applyRecipeFilter()
        this._applyCollFilter()
      })
    }).catch(() => this.setData({ listLoading: false }))
  },

  // ════════════════════════════════════════════════════════
  // Tab1：AI酒单（原有逻辑）
  // ════════════════════════════════════════════════════════

  onSelectGoal(e)   { this.setData({ selectedGoal:   e.currentTarget.dataset.val }) },
  onSelectFlavor(e) { this.setData({ selectedFlavor: e.currentTarget.dataset.val }) },
  onMenuCustomPromptInput(e) { this.setData({ menuCustomPrompt: e.detail.value }) },

  onGenerate() {
    if (this.data.isLoading) return
    if (!this.data.isPro && this.data.quotaRemaining <= 0) {
      wx.showModal({
        title: '本月 AI 次数已用完',
        content: `Free 版每月可生成 ${this.data.quotaLimit} 次，本月已用完。`,
        confirmText: '升级 Pro', cancelText: '下月再用',
        success: (res) => { if (res.confirm) wx.navigateTo({ url: '/pages/subscription/subscription' }) }
      })
      return
    }
    this.setData({ isLoading: true, menuItems: [], hasGenerated: false, fromCache: false, loadingMsg: '正在连接 AI' })
    this._startDots()
    wx.showNavigationBarLoading()
    wx.cloud.callFunction({
      name: 'ai-menu',
      data: {
        action:       'generate',
        goal:         this.data.selectedGoal,
        flavor:       this.data.selectedFlavor,
        customPrompt: this.data.menuCustomPrompt || '',
      },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) { this._handleError(r.error); return }
      this._showResult(r)
    }).catch(() => {
      this._stopLoading()
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    })
  },

  _startPolling(taskId) { this._pollCount = 0; this._schedulePoll(taskId) },
  _schedulePoll(taskId) {
    this._pollTimer = setTimeout(() => {
      this._pollCount++
      if (this._pollCount === 5)  this.setData({ loadingMsg: 'AI 正在构思酒款' })
      if (this._pollCount === 12) this.setData({ loadingMsg: 'AI 正在计算成本利润' })
      if (this._pollCount === 20) this.setData({ loadingMsg: '即将完成，请稍候' })
      if (this._pollCount > 45) {
        this._stopLoading()
        wx.showModal({ title: '生成超时', content: 'AI 响应时间较长，请稍后重试。', showCancel: false })
        return
      }
      wx.cloud.callFunction({ name: 'ai-menu', data: { action: 'poll', taskId } })
        .then(res => {
          const r = res.result || {}
          if (!r.success) {
            if (r.error === 'task_not_found' && this._pollCount < 3) { this._schedulePoll(taskId); return }
            this._handleError(r.error); return
          }
          if (r.status === 'pending') { this._schedulePoll(taskId); return }
          this._showResult(r)
        }).catch(() => this._schedulePoll(taskId))
    }, 2000)
  },

  _showResult(r) {
    this._stopLoading()
    if (r.quotaRemaining != null) this.setData({ quotaUsed: r.quotaUsed, quotaRemaining: r.quotaRemaining })
    const menuItems = r.cocktails || []
    // 提取缺货原料名 → globalData，供采购Tab跨Tab读取
    const gapSet = new Set()
    menuItems.forEach(c => { (c.ingredients || []).forEach(ing => { if (ing.isMissing) gapSet.add(ing.name) }) })
    app.globalData.aiMenuGaps = [...gapSet]
    this.setData({ menuItems, hasGenerated: true, fromCache: !!r.fromCache })
    if (r.fromCache) wx.showToast({ title: '已加载今日缓存', icon: 'none', duration: 1500 })
  },

  _handleError(errorCode) {
    this._stopLoading()
    if (errorCode === 'quota_exceeded') {
      wx.showModal({
        title: '本月次数已用完', content: 'Free 版每月可生成 10 次，已全部用完。升级 Pro 可无限生成。',
        confirmText: '升级 Pro', cancelText: '关闭',
        success: (res) => { if (res.confirm) wx.navigateTo({ url: '/pages/subscription/subscription' }) }
      })
    } else if (errorCode && (errorCode.includes('BAILIAN_API_KEY') || errorCode.includes('not configured'))) {
      wx.showToast({ title: 'AI 服务未配置，请联系管理员', icon: 'none', duration: 3000 })
    } else {
      wx.showToast({ title: 'AI 生成失败，请稍后重试', icon: 'none' })
    }
  },

  _startDots() {
    let count = 0
    this._dotTimer = setInterval(() => {
      count = (count + 1) % 4
      this.setData({ loadingDots: '·'.repeat(count || 1) })
    }, 500)
  },
  _stopLoading() {
    this.setData({ isLoading: false, loadingDots: '' })
    if (this._dotTimer)  { clearInterval(this._dotTimer);  this._dotTimer  = null }
    if (this._pollTimer) { clearTimeout(this._pollTimer);  this._pollTimer = null }
    wx.hideNavigationBarLoading()
  },

  onToggleCard(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ [`menuItems[${idx}].expanded`]: !this.data.menuItems[idx].expanded })
  },

  onSaveToMyRecipe(e) {
    const idx  = e.currentTarget.dataset.index
    const item = this.data.menuItems[idx]
    if (!item || item.saved || item.saving) return
    this.setData({ [`menuItems[${idx}].saving`]: true })
    const payload = {
      name:        item.name,
      emoji:       item.emoji || '🍸',
      base:        this._guessBase(item.ingredients),
      desc:        `毛利 ${item.grossMargin}% · 建议售价 ¥${item.suggestedPrice}`,
      ingredients: (item.ingredients || []).map(ing => ({ name: ing.name, amount: `${ing.amount}${ing.unit || ''}`.trim() })),
      steps:       item.steps  || [],
      notes:       item.notes  || `AI 酒单推荐 · 成本 ¥${item.costEstimate}`,
      isAI: true, fromAIMenu: true,
    }
    wx.cloud.callFunction({ name: 'recipes', data: { action: 'add', payload } })
      .then(res => {
        const r = res.result || {}
        if (r.success) {
          this.setData({ [`menuItems[${idx}].saving`]: false, [`menuItems[${idx}].saved`]: true, [`menuItems[${idx}].savedId`]: r.id })
          wx.showToast({ title: '已存入我的配方 ✓', icon: 'success' })
        } else {
          this.setData({ [`menuItems[${idx}].saving`]: false })
          wx.showToast({ title: r.error || '保存失败', icon: 'none' })
        }
      }).catch(() => {
        this.setData({ [`menuItems[${idx}].saving`]: false })
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      })
  },

  onAddToMyCollection(e) {
    const idx  = e.currentTarget.dataset.index
    const item = this.data.menuItems[idx]
    if (!item) return
    const doAdd = (recipeId) => {
      wx.cloud.callFunction({ name: 'recipes', data: { action: 'collList' } })
        .then(res => {
          const colls = (res.result && res.result.data) || []
          if (!colls.length) {
            wx.showModal({ title: '还没有合集', content: '请先在「配方」页面创建合集', confirmText: '去创建', showCancel: true,
              success: (r) => { if (r.confirm) wx.switchTab({ url: '/pages/my-recipes/my-recipes' }) } })
            return
          }
          wx.showActionSheet({
            itemList: colls.map(c => `${c.emoji || '📂'} ${c.name}`),
            success: (as) => {
              const coll = colls[as.tapIndex]
              wx.cloud.callFunction({ name: 'recipes', data: { action: 'collToggle', collId: coll._id || coll.id, recipeId } })
                .then(res2 => {
                  const r2 = res2.result || {}
                  wx.showToast({ title: r2.success ? `已加入「${coll.name}」✓` : '操作失败', icon: r2.success ? 'success' : 'none' })
                })
            },
          })
        })
    }
    if (item.savedId) { doAdd(item.savedId); return }
    wx.showLoading({ title: '正在保存…', mask: true })
    const payload = {
      name: item.name, emoji: item.emoji || '🍸', base: this._guessBase(item.ingredients),
      desc: `毛利 ${item.grossMargin}% · 建议售价 ¥${item.suggestedPrice}`,
      ingredients: (item.ingredients || []).map(ing => ({ name: ing.name, amount: `${ing.amount}${ing.unit || ''}`.trim() })),
      steps: item.steps || [], notes: item.notes || '', isAI: true, fromAIMenu: true,
    }
    wx.cloud.callFunction({ name: 'recipes', data: { action: 'add', payload } })
      .then(res => {
        wx.hideLoading()
        const r = res.result || {}
        if (r.success) {
          this.setData({ [`menuItems[${idx}].saved`]: true, [`menuItems[${idx}].savedId`]: r.id })
          doAdd(r.id)
        } else { wx.showToast({ title: '保存失败，请重试', icon: 'none' }) }
      }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }) })
  },

  _guessBase(ingredients) {
    const bases = ['金酒', '伏特加', '朗姆酒', '龙舌兰', '威士忌', '白兰地', '白酒']
    const first = (ingredients || []).find(ing => bases.some(b => (ing.name || '').includes(b)))
    return first ? first.name : ''
  },

  // ════════════════════════════════════════════════════════
  // Tab3: AI 采购
  // ════════════════════════════════════════════════════════

  _purchGenerate() {
    if (this.data.purchLoading) return
    this.setData({ purchLoading: true })
    DB.getAll().then(all => {
      const aiGaps = app.globalData.aiMenuGaps || []
      const items  = []

      all.forEach(ing => {
        const sourceThreshold = ing.status === 'danger' || ing.status === 'warn'
        const sourceMenu      = aiGaps.includes(ing.name)
        if (!sourceThreshold && !sourceMenu) return

        let suggestQty = calcSuggestQty(ing.stock, ing.threshold)
        // 仅AI缺口但库存未低于阈值：建议采购半个阈值量
        if (suggestQty <= 0 && sourceMenu) suggestQty = Math.max(1, Math.round((ing.threshold || 1) * 0.5))
        if (suggestQty <= 0) return

        const estimateCost = (suggestQty * (ing.costPerUnit || 0)).toFixed(0)
        items.push({
          id: ing._id || ing.id, ingredientId: ing._id || ing.id,
          emoji: ing.emoji || '🧪', name: ing.name, brand: ing.brand || '',
          unit: ing.unit, currentStock: ing.stock, threshold: ing.threshold,
          suggestQty, estimateCost, costPerUnit: ing.costPerUnit || 0,
          sourceThreshold, sourceMenu, inInventory: true,
          urgent: ing.status === 'danger', checked: false,
        })
      })

      // AI酒单中完全没有库存记录的原料
      aiGaps.forEach(gapName => {
        if (!all.find(ing => ing.name === gapName)) {
          items.push({
            id: 'gap_' + gapName, ingredientId: null,
            emoji: '🛒', name: gapName, brand: '',
            unit: '-', currentStock: 0, threshold: 0,
            suggestQty: 1, estimateCost: '0', costPerUnit: 0,
            sourceThreshold: false, sourceMenu: true, inInventory: false,
            urgent: false, checked: false,
          })
        }
      })

      items.sort((a, b) => {
        if (a.urgent !== b.urgent)           return a.urgent ? -1 : 1
        if (a.sourceThreshold !== b.sourceThreshold) return a.sourceThreshold ? -1 : 1
        return 0
      })

      const totalCost   = items.reduce((s, i) => s + Number(i.estimateCost), 0)
      const menuCount   = items.filter(i => i.sourceMenu).length
      const filters     = [
        { val:'all',       label:'全部',        count: items.length },
        { val:'urgent',    label:'⚡ 紧急',      count: items.filter(i => i.urgent).length },
        { val:'threshold', label:'🔴 低库存',   count: items.filter(i => i.sourceThreshold).length },
      ]
      if (menuCount > 0) filters.push({ val:'menu', label:'✨ 酒单缺口', count: menuCount })

      this.setData({
        purchAllItems:      items,
        purchFilteredItems: items,
        purchCheckedItems:  [],
        purchTotalItems:    items.length,
        purchUrgentItems:   items.filter(i => i.urgent).length,
        purchTotalCost:     totalCost.toFixed(0),
        purchGenTime:       purchNowStr(),
        purchCurrentSource: 'all',
        purchLoading:       false,
        purchSourceFilters: filters,
        purchHasMenuGaps:   menuCount > 0,
      })
      this._purchLoadListState()
    }).catch(() => this.setData({ purchLoading: false }))
  },

  onPurchRefresh() {
    if (this.data.purchMode === 'coll' && this.data.purchSelectedCollId) {
      RDB.invalidateCache()
      RDB.preload().then(() => this._purchGenerateFromColl(this.data.purchSelectedCollId))
    } else {
      DB.getAll({ forceRefresh: true }).then(() => this._purchGenerate())
    }
  },

  // ── 模式切换 ─────────────────────────────────────────────
  onPurchModeSwitch(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.purchMode) return
    this.setData({
      purchMode: mode,
      purchSelectedCollId: '', purchSelectedCollName: '',
      purchAllItems: [], purchFilteredItems: [], purchCheckedItems: [],
      purchTotalItems: 0, purchUrgentItems: 0, purchTotalCost: '0',
      purchSourceFilters: [], purchCurrentSource: 'all',
    })
    if (mode === 'stock') this._purchGenerate()
  },

  // ── 按酒单采购：合集列表 ─────────────────────────────────
  _purchLoadCollList() {
    RDB.preload().then(() => {
      const colls = RDB.getCollAll()
      const purchCollList = colls.map(c => ({
        id:    c._id || c.id,
        name:  c.name,
        emoji: c.emoji || '📂',
        count: c.count || (c.recipeIds || []).length,
      }))
      this.setData({ purchCollList })
    })
  },

  onPurchCollSelect(e) {
    const { id, name } = e.currentTarget.dataset
    this.setData({ purchSelectedCollId: id, purchSelectedCollName: name })
    this._purchGenerateFromColl(id)
  },

  _purchGenerateFromColl(collId) {
    this.setData({ purchLoading: true })
    RDB.preload().then(() => {
      const coll = RDB.getCollById(collId)
      if (!coll) { this.setData({ purchLoading: false }); return }
      const recipeIds = coll.recipeIds || []
      if (!recipeIds.length) {
        this.setData({
          purchLoading: false, purchAllItems: [], purchFilteredItems: [],
          purchTotalItems: 0, purchTotalCost: '0', purchSourceFilters: [],
        })
        wx.showToast({ title: '该合集暂无配方', icon: 'none' })
        return
      }
      const allRecipes = RDB.getMyAll()
      const recipes    = allRecipes.filter(r => recipeIds.includes(r._id || r.id))

      // 聚合所有配方的原料用量
      const ingMap = {}  // name -> { totalAmount, unit }
      recipes.forEach(recipe => {
        ;(recipe.ingredients || []).forEach(ing => {
          const name   = ing.name
          const amount = _parseIngAmount(ing.amount)
          const unit   = _parseIngUnit(ing.amount)
          if (ingMap[name]) { ingMap[name].totalAmount += amount }
          else              { ingMap[name] = { totalAmount: amount, unit } }
        })
      })

      DB.getAll().then(inventory => {
        const items = []
        Object.entries(ingMap).forEach(([name, { totalAmount, unit }]) => {
          const invIng      = inventory.find(i => i.name === name)
          const currentStock = invIng ? invIng.stock : 0
          const needed       = Math.round(totalAmount * 100) / 100
          const suggestQty   = invIng ? Math.max(0, needed - currentStock) : needed
          if (suggestQty <= 0) return  // 库存充足，跳过
          items.push({
            id:           'coll_' + name,
            ingredientId: invIng ? (invIng._id || invIng.id) : null,
            emoji:        invIng ? (invIng.emoji || '🧪') : '🛒',
            name,
            brand:        invIng ? (invIng.brand || '') : '',
            unit:         unit || (invIng ? invIng.unit : '-'),
            currentStock,
            threshold:    invIng ? invIng.threshold : 0,
            neededQty:    needed,
            suggestQty:   Math.ceil(suggestQty),
            estimateCost: (Math.ceil(suggestQty) * (invIng ? (invIng.costPerUnit || 0) : 0)).toFixed(0),
            costPerUnit:  invIng ? (invIng.costPerUnit || 0) : 0,
            inInventory:  !!invIng,
            urgent:       !invIng,
            checked:      false,
            sourceThreshold: false, sourceMenu: false,
          })
        })

        items.sort((a, b) => {
          if (!a.inInventory && b.inInventory) return -1
          if (a.inInventory && !b.inInventory) return 1
          return 0
        })

        const totalCost       = items.reduce((s, i) => s + Number(i.estimateCost), 0)
        const noInventoryCnt  = items.filter(i => !i.inInventory).length
        const insufficientCnt = items.filter(i => i.inInventory).length
        const filters = [
          { val:'all',          label:'全部',       count: items.length },
          { val:'noInventory',  label:'🆕 无记录',  count: noInventoryCnt },
          { val:'insufficient', label:'📦 需补货',  count: insufficientCnt },
        ]
        this.setData({
          purchAllItems:      items,
          purchFilteredItems: items,
          purchCheckedItems:  [],
          purchTotalItems:    items.length,
          purchUrgentItems:   noInventoryCnt,
          purchTotalCost:     totalCost.toFixed(0),
          purchGenTime:       purchNowStr(),
          purchCurrentSource: 'all',
          purchLoading:       false,
          purchSourceFilters: filters,
          purchHasMenuGaps:   false,
        })
        this._purchLoadListState()
      }).catch(() => this.setData({ purchLoading: false }))
    }).catch(() => this.setData({ purchLoading: false }))
  },

  onPurchFilterSource(e) {
    const val = e.currentTarget.dataset.val
    const { purchAllItems } = this.data
    let filtered = purchAllItems.filter(i => !i.checked)
    if (val === 'urgent')       filtered = filtered.filter(i => i.urgent)
    if (val === 'threshold')    filtered = filtered.filter(i => i.sourceThreshold)
    if (val === 'menu')         filtered = filtered.filter(i => i.sourceMenu)
    if (val === 'noInventory')  filtered = filtered.filter(i => !i.inInventory)
    if (val === 'insufficient') filtered = filtered.filter(i => i.inInventory)
    this.setData({ purchCurrentSource: val, purchFilteredItems: filtered })
  },

  onPurchAdjust(e) {
    const { id, delta } = e.currentTarget.dataset
    const items = this.data.purchAllItems.map(item => {
      if (item.id !== id) return item
      const newQty = Math.max(1, item.suggestQty + Number(delta))
      return { ...item, suggestQty: newQty, estimateCost: (newQty * item.costPerUnit).toFixed(0) }
    })
    this._purchRebuild(items)
  },

  onPurchToggle(e) {
    const id = e.currentTarget.dataset.id
    const items = this.data.purchAllItems.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
    this._purchRebuild(items)
  },

  onPurchToggleChecked() { this.setData({ purchShowChecked: !this.data.purchShowChecked }) },

  _purchRebuild(items) {
    const { purchCurrentSource } = this.data
    let filtered = items.filter(i => !i.checked)
    if (purchCurrentSource === 'urgent')       filtered = filtered.filter(i => i.urgent)
    if (purchCurrentSource === 'threshold')    filtered = filtered.filter(i => i.sourceThreshold)
    if (purchCurrentSource === 'menu')         filtered = filtered.filter(i => i.sourceMenu)
    if (purchCurrentSource === 'noInventory')  filtered = filtered.filter(i => !i.inInventory)
    if (purchCurrentSource === 'insufficient') filtered = filtered.filter(i => i.inInventory)
    const totalCost = items.reduce((s, i) => s + Number(i.estimateCost), 0)
    this.setData({
      purchAllItems:      items,
      purchFilteredItems: filtered,
      purchCheckedItems:  items.filter(i => i.checked),
      purchTotalCost:     totalCost.toFixed(0),
    })
  },

  onPurchCopy() {
    const { purchAllItems, purchTotalCost, purchGenTime, purchMode, purchSelectedCollName } = this.data
    const unchecked = purchAllItems.filter(i => !i.checked)
    if (!unchecked.length) { wx.showToast({ title: '清单已全部采购完成', icon: 'none' }); return }
    const header = purchMode === 'coll' ? `【Bacchus 采购清单】酒单：${purchSelectedCollName} · ${purchGenTime}` : `【Bacchus 采购清单】${purchGenTime}`
    let text = `${header}\n${'─'.repeat(20)}\n`
    unchecked.forEach((item, idx) => {
      const tags = []
      if (purchMode === 'stock') {
        if (item.urgent)     tags.push('⚡紧急')
        if (item.sourceMenu) tags.push('✨酒单缺口')
      } else {
        if (!item.inInventory) tags.push('🆕新原料')
      }
      const hintStr = purchMode === 'coll' ? `（配方需${item.neededQty}${item.unit}，库存${item.inInventory ? item.currentStock + item.unit : '无记录'}）` : ''
      text += `${idx+1}. ${item.emoji}${item.name}${hintStr}\n   采购量：${item.suggestQty}${item.unit}  预估：¥${item.estimateCost}`
      if (tags.length) text += `  ${tags.join(' ')}`
      text += '\n'
    })
    text += `${'─'.repeat(20)}\n合计预估：¥${purchTotalCost}`
    wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' }) })
  },

  // ── 采购清单 ─────────────────────────────────────────────
  _purchLoadListState() {
    const col = wx.cloud.database().collection('shopping_list')
    col.get()
      .then(res => {
        const stored = res.data || []
        const inList = {}
        stored.forEach(i => { inList[i.name] = true })
        this.setData({ purchShoppingListCount: stored.length, purchItemsInList: inList })
      })
      .catch(() => {})
  },

  onPurchAddToList(e) {
    const name = e.currentTarget.dataset.name
    const item = this.data.purchAllItems.find(i => i.name === name)
    if (!item) return
    const db  = wx.cloud.database()
    const col = db.collection('shopping_list')
    const inList = { ...this.data.purchItemsInList }

    if (inList[name]) {
      // 已在清单 → 移除
      col.where({ name: db.command.eq(name) }).get()
        .then(res => {
          if (!res.data || !res.data[0]) return
          return col.doc(res.data[0]._id).remove()
        })
        .then(() => {
          delete inList[name]
          this.setData({
            purchShoppingListCount: Math.max(0, this.data.purchShoppingListCount - 1),
            purchItemsInList: inList,
          })
          wx.showToast({ title: '已从清单移除', icon: 'none', duration: 1000 })
        })
        .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
    } else {
      // 加入清单
      const now = Date.now()
      col.add({
        data: {
          ingredientId: item.ingredientId || null,
          name:         item.name,
          emoji:        item.emoji,
          brand:        item.brand,
          unit:         item.unit,
          currentStock: item.currentStock,
          suggestQty:   item.suggestQty,
          costPerUnit:  item.costPerUnit,
          estimateCost: item.estimateCost,
          inInventory:  item.inInventory,
          stockedIn:    false,
          addedAt:      now,
          updatedAt:    now,
        },
      }).then(() => {
        inList[name] = true
        this.setData({
          purchShoppingListCount: this.data.purchShoppingListCount + 1,
          purchItemsInList: inList,
        })
        wx.showToast({ title: '已加入采购清单', icon: 'success', duration: 1000 })
      }).catch(() => wx.showToast({ title: '加入失败，请重试', icon: 'none' }))
    }
  },

  onPurchGoShoppingList() {
    wx.navigateTo({ url: '/pages/shopping-list/shopping-list' })
  },

  // ════════════════════════════════════════════════════════
  // Tab4: 经营分析
  // ════════════════════════════════════════════════════════

  _analyticsOnTabEnter() {
    const s = app.globalData.shopInfo || {}
    this.setData({ analIsPro: s.plan === 'pro' || s.plan === 'Pro' })
    if (!this._analyticsCanvasReady) {
      const sys    = wx.getSystemInfoSync()
      const ratio  = sys.screenWidth / 750
      const analChartW = Math.floor(sys.screenWidth - 112 * ratio)
      const analLineH  = Math.floor(320 * ratio)
      const analBarH   = Math.floor(300 * ratio)
      this._analyticsDpr = sys.pixelRatio || 2
      this.setData({ analChartW, analLineH, analBarH })
      setTimeout(() => this._analyticsInitCanvases(), 120)
    } else {
      this._analyticsLoadData()
    }
  },

  _analyticsInitCanvases() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#aiLineChart').fields({ node: true, size: true })
    query.select('#aiBarChart').fields({ node: true, size: true })
    query.exec(res => {
      if (!res[0]?.node || !res[1]?.node) {
        setTimeout(() => this._analyticsInitCanvases(), 120)
        return
      }
      const dpr = this._analyticsDpr
      const { analChartW, analLineH, analBarH } = this.data
      const lc = res[0].node
      lc.width  = analChartW * dpr; lc.height = analLineH * dpr
      this._analyticsLineCanvas = lc
      const bc = res[1].node
      bc.width  = analChartW * dpr; bc.height = analBarH * dpr
      this._analyticsBarCanvas = bc
      this._analyticsCanvasReady = true
      const defaultDist = { labels:['正常','偏低','告急'], values:[0,0,0], colors:['#4caf84','#c9a96e','#e05c5c'] }
      this._analyticsDrawLine(this._analyticsTrendData[this.data.analCurrentPeriod])
      this._analyticsDrawBar(defaultDist)
      this._analyticsLoadData()
    })
  },

  _analyticsLoadData() {
    if (app.globalData.isOffline) return
    this.setData({ analIsLoading: true })
    const period = this.data.analCurrentPeriod
    wx.cloud.callFunction({ name: 'analytics', data: { action: 'summary', period } })
      .then(res => {
        const r = res.result || {}
        this.setData({ analIsLoading: false })
        if (!r.success) { wx.showToast({ title: '数据加载失败', icon: 'none' }); return }
        this.setData({
          analIsEmpty:        r.isEmpty,
          analKpi:            r.kpi || { ...EMPTY_KPI },
          analTopIngredients: r.topIngredients || [],
          analStockDist:      r.stockDist || null,
        })
        if (r.trend) this._analyticsTrendData[period] = r.trend
        this._analyticsStockDist = r.stockDist
        if (this._analyticsLineCanvas) this._analyticsDrawLine(this._analyticsTrendData[period])
        const dist = r.stockDist || { labels:['正常','偏低','告急'], values:[0,0,0], colors:['#4caf84','#c9a96e','#e05c5c'] }
        if (this._analyticsBarCanvas) this._analyticsDrawBar(dist)
      }).catch(() => this.setData({ analIsLoading: false }))
  },

  onAnalPeriod(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ analCurrentPeriod: val, analKpi: { ...EMPTY_KPI }, analIsLoading: true })
    wx.cloud.callFunction({ name: 'analytics', data: { action: 'summary', period: val } })
      .then(res => {
        const r = res.result || {}
        this.setData({ analIsLoading: false })
        if (!r.success) return
        this.setData({ analIsEmpty: r.isEmpty, analKpi: r.kpi || { ...EMPTY_KPI } })
        if (r.trend) {
          this._analyticsTrendData[val] = r.trend
          if (this._analyticsLineCanvas) this._analyticsDrawLine(r.trend)
        }
      }).catch(() => this.setData({ analIsLoading: false }))
  },

  onAnalAIAdvice() {
    if (!this.data.analIsPro) {
      wx.showModal({
        title: 'Pro 专属功能',
        content: 'AI 经营建议是 Pro 版专属功能，升级后每天可获取 3 次 AI 智能分析。',
        confirmText: '去升级',
        success: (res) => { if (res.confirm) wx.navigateTo({ url: '/pages/subscription/subscription' }) }
      })
      return
    }
    this._analyticsLoadAIAdvice(false)
  },

  onAnalRefreshAdvice() { this._analyticsLoadAIAdvice(true) },

  _analyticsLoadAIAdvice(forceRefresh) {
    if (this.data.analAiAdviceLoading) return
    if (app.globalData.isOffline) { wx.showToast({ title: '离线模式无法获取 AI 建议', icon: 'none' }); return }
    this.setData({ analAiAdviceLoading: true, analAiAdviceError: '' })
    wx.cloud.callFunction({ name: 'analytics', data: { action: 'aiAdvice', period: this.data.analCurrentPeriod, forceRefresh } })
      .then(res => {
        const r = res.result || {}
        this.setData({ analAiAdviceLoading: false })
        if (r.success && r.advice) {
          this.setData({ analAiAdvice: r.advice })
        } else if (r.error === 'pro_required') {
          this.setData({ analAiAdviceError: '此功能需要 Pro 版' })
        } else if (r.error === 'daily_limit') {
          this.setData({ analAiAdviceError: `今日 AI 建议已用完（${r.limit}次/天），明天再来` })
        } else {
          this.setData({ analAiAdviceError: 'AI 分析失败，请稍后重试' })
        }
      }).catch(() => this.setData({ analAiAdviceLoading: false, analAiAdviceError: '网络异常，请重试' }))
  },

  _analyticsDrawLine(data) {
    if (!this._analyticsLineCanvas) return
    const ctx = this._analyticsLineCanvas.getContext('2d')
    ctx.setTransform(this._analyticsDpr, 0, 0, this._analyticsDpr, 0, 0)
    analDrawLineChart(ctx, this.data.analChartW, this.data.analLineH, data)
  },

  _analyticsDrawBar(data) {
    if (!this._analyticsBarCanvas) return
    const ctx = this._analyticsBarCanvas.getContext('2d')
    ctx.setTransform(this._analyticsDpr, 0, 0, this._analyticsDpr, 0, 0)
    analDrawBarChart(ctx, this.data.analChartW, this.data.analBarH, data)
  },

  onPurchase() {
    this.setData({ activeTab: 'purchase' }, () => this._purchGenerate())
  },

  // ════════════════════════════════════════════════════════
  // Step 3: 营销图 — 目标选择
  // ════════════════════════════════════════════════════════

  onMktgModeSwitch(e) {
    this.setData({
      mktgMode: e.currentTarget.dataset.mode,
      selectedRecipe: null, selectedColl: null,
      mktgState: 'idle', mktgError: '',
      recipeSearch: '', recipeFilter: 'all',
      collSearch: '',   collFilter: 'all',
    }, () => {
      this._applyRecipeFilter()
      this._applyCollFilter()
    })
  },

  // ── 筛选 & 搜索辅助 ─────────────────────────────────────
  _applyRecipeFilter() {
    const { recipeList, recipeSearch, recipeFilter } = this.data
    let list = recipeList
    if (recipeFilter !== 'all') {
      list = list.filter(r => r.base && r.base.includes(recipeFilter))
    }
    if (recipeSearch.trim()) {
      const q = recipeSearch.trim().toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q))
    }
    this.setData({ recipeListFiltered: list })
  },

  _applyCollFilter() {
    const { collList, collSearch, collFilter } = this.data
    let list = collList
    if (collFilter === 'small')  list = list.filter(c => c.count <= 3)
    else if (collFilter === 'medium') list = list.filter(c => c.count >= 4 && c.count <= 9)
    else if (collFilter === 'large')  list = list.filter(c => c.count >= 10)
    if (collSearch.trim()) {
      const q = collSearch.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q))
    }
    this.setData({ collListFiltered: list })
  },

  onRecipeSearchInput(e) {
    this.setData({ recipeSearch: e.detail.value }, () => this._applyRecipeFilter())
  },
  onRecipeFilterTap(e) {
    this.setData({ recipeFilter: e.currentTarget.dataset.id }, () => this._applyRecipeFilter())
  },
  onCollSearchInput(e) {
    this.setData({ collSearch: e.detail.value }, () => this._applyCollFilter())
  },
  onCollFilterTap(e) {
    this.setData({ collFilter: e.currentTarget.dataset.id }, () => this._applyCollFilter())
  },

  // 选配方
  onSelectRecipe(e) {
    const id = e.currentTarget.dataset.id
    const r  = this.data.recipeList.find(x => x.id === id)
    if (!r) return
    this.setData({
      selectedRecipe: r,
      mktgState: 'idle', mktgError: '', customPrompt: '',
    })
  },

  // 选合集
  onSelectColl(e) {
    const id = e.currentTarget.dataset.id
    const c  = this.data.collList.find(x => x.id === id)
    if (!c) return
    const shopName = (app.globalData.shopInfo && app.globalData.shopInfo.name) || '我的酒吧'
    this.setData({
      selectedColl: c,
      mktgState: 'idle', mktgError: '', customPrompt: '',
      canvasLayout: {
        shopName,
        headline:  c.name,
        subline:   c.desc || '',
        cocktails: (c.recipes || []).slice(0, 6).map(r => ({ name: r.name, price: '' })),
      },
    })
  },

  onMktgTypeSwitch(e) { this.setData({ mktgType: e.currentTarget.dataset.type }) },
  onImgStyleTap(e)    { this.setData({ imgStyle:    e.currentTarget.dataset.id }) },
  onPosterStyleTap(e) { this.setData({ posterStyle: e.currentTarget.dataset.id }) },
  onCustomPromptInput(e) { this.setData({ customPrompt: e.detail.value }) },

  // ════════════════════════════════════════════════════════
  // Step 3: 单品营销图生成
  // ════════════════════════════════════════════════════════

  onGenRecipeImg() {
    const { selectedRecipe, imgStyle, posterStyle, customPrompt, canvasLayout } = this.data
    if (!selectedRecipe) { wx.showToast({ title: '请先选择配方', icon: 'none' }); return }

    this.setData({ mktgState: 'loading', mktgLoadStep: '正在生成描述词…', mktgError: '' })

    wx.cloud.callFunction({
      name: 'imagegen',
      data: { action: 'buildPrompt', type: 'recipe', data: selectedRecipe, style: imgStyle, customPrompt },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) { this.setData({ mktgState: 'error', mktgError: r.error || '描述词生成失败' }); return }
      this.setData({ mktgLoadStep: '正在渲染图片…' })
      wx.cloud.callFunction({
        name: 'imagegen',
        data: {
          action: 'genImage', prompt: r.prompt, negPrompt: r.negPrompt || '',
          style: imgStyle, nameHint: selectedRecipe.name.slice(0, 12),
          targetType: 'recipe', targetId: selectedRecipe.id,
        },
      }).then(res2 => {
        const r2 = res2.result || {}
        if (!r2.success) { this.setData({ mktgState: 'error', mktgError: r2.error || '图片生成失败' }); return }
        this.setData({ mktgState: 'idle' })
        this._goToEdit({
          mktgMode: 'recipe', mktgType: 'cover',
          targetType: 'recipe', targetId: selectedRecipe.id,
          targetName: selectedRecipe.name, targetEmoji: selectedRecipe.emoji || '🍹',
          selectedData: selectedRecipe, imgStyle, posterStyle, customPrompt, canvasLayout,
          currentImg: { fileID: r2.fileID, tempUrl: r2.tempUrl, localPath: '', imageId: '', isCover: true, style: imgStyle, imageType: 'cover' },
        })
      }).catch(() => this.setData({ mktgState: 'error', mktgError: '生图请求失败，请检查网络' }))
    }).catch(() => this.setData({ mktgState: 'error', mktgError: '描述词生成失败' }))
  },

  // ════════════════════════════════════════════════════════
  // Step 4: 合集营销图生成（含 Canvas 排版）
  // ════════════════════════════════════════════════════════

  onGenCollImg() {
    const { selectedColl, mktgType, imgStyle, posterStyle, customPrompt, canvasLayout } = this.data
    if (!selectedColl) { wx.showToast({ title: '请先选择合集', icon: 'none' }); return }

    this.setData({ mktgState: 'loading', mktgLoadStep: '正在生成背景…', mktgError: '' })

    if (mktgType === 'cover') {
      // 封面图：1:1
      wx.cloud.callFunction({
        name: 'imagegen',
        data: { action: 'buildPrompt', type: 'collection', data: selectedColl, style: imgStyle, customPrompt },
      }).then(res => {
        const r = res.result || {}
        if (!r.success) { this.setData({ mktgState: 'error', mktgError: r.error || '描述生成失败' }); return }
        this.setData({ mktgLoadStep: '正在渲染图片…' })
        wx.cloud.callFunction({
          name: 'imagegen',
          data: { action: 'genImage', prompt: r.prompt, negPrompt: r.negPrompt || '',
                  style: imgStyle, nameHint: selectedColl.name.slice(0, 12),
                  targetType: 'collection', targetId: selectedColl.id },
        }).then(res2 => {
          const r2 = res2.result || {}
          if (!r2.success) { this.setData({ mktgState: 'error', mktgError: r2.error || '图片生成失败' }); return }
          this.setData({ mktgState: 'idle' })
          this._goToEdit({
            mktgMode: 'collection', mktgType: 'cover',
            targetType: 'collection', targetId: selectedColl.id,
            targetName: selectedColl.name, targetEmoji: selectedColl.emoji || '📂',
            selectedData: selectedColl, imgStyle, posterStyle, customPrompt, canvasLayout,
            currentImg: { fileID: r2.fileID, tempUrl: r2.tempUrl, localPath: '', imageId: '', isCover: true, style: imgStyle, imageType: 'cover' },
          })
        }).catch(() => this.setData({ mktgState: 'error', mktgError: '生图请求失败' }))
      }).catch(() => this.setData({ mktgState: 'error', mktgError: '描述生成失败' }))

    } else {
      // 海报/酒单图：3:4
      wx.cloud.callFunction({
        name: 'imagegen',
        data: { action: 'buildPosterPrompt', data: selectedColl, posterStyle, customPrompt },
      }).then(res => {
        const r = res.result || {}
        if (!r.success) { this.setData({ mktgState: 'error', mktgError: r.error || '描述生成失败' }); return }
        this.setData({ mktgLoadStep: '正在渲染背景图…' })
        wx.cloud.callFunction({
          name: 'imagegen',
          data: { action: 'genPoster', prompt: r.prompt, negPrompt: r.negPrompt || '',
                  size: r.size || '1024x1344', posterStyle,
                  targetId: selectedColl.id, nameHint: selectedColl.name.slice(0, 12) },
        }).then(res2 => {
          const r2 = res2.result || {}
          if (!r2.success) { this.setData({ mktgState: 'error', mktgError: r2.error || '背景图生成失败' }); return }
          this.setData({ mktgState: 'idle' })
          this._goToEdit({
            mktgMode: 'collection', mktgType,
            targetType: 'collection', targetId: selectedColl.id,
            targetName: selectedColl.name, targetEmoji: selectedColl.emoji || '📂',
            selectedData: selectedColl, imgStyle, posterStyle, customPrompt, canvasLayout,
            currentImg: { fileID: r2.fileID, tempUrl: r2.tempUrl, localPath: '', imageId: '', isCover: false, style: posterStyle, imageType: 'poster' },
          })
        }).catch(() => this.setData({ mktgState: 'error', mktgError: '背景图生成失败' }))
      }).catch(() => this.setData({ mktgState: 'error', mktgError: '描述生成失败' }))
    }
  },

  // ── 跳转 ai-edit 页（写入 globalData 后导航）────────────
  _goToEdit(ctx) {
    app.globalData.aiEditContext = ctx
    wx.navigateTo({ url: '/pages/ai-edit/ai-edit' })
  },

  // 「查看/编辑已生成图片」按钮：无需重新生成，直接跳 ai-edit
  onViewHistoryImgs() {
    const { mktgMode, mktgType, selectedRecipe, selectedColl, imgStyle, posterStyle, customPrompt, canvasLayout } = this.data
    const target = mktgMode === 'recipe' ? selectedRecipe : selectedColl
    if (!target) { wx.showToast({ title: '请先选择目标', icon: 'none' }); return }
    const targetType = mktgMode === 'recipe' ? 'recipe' : 'collection'
    this._goToEdit({
      mktgMode, mktgType, targetType,
      targetId:    target.id,
      targetName:  target.name,
      targetEmoji: target.emoji || (mktgMode === 'recipe' ? '🍹' : '📂'),
      selectedData: target, imgStyle, posterStyle, customPrompt, canvasLayout,
      currentImg: null,   // 让 ai-edit 自己从历史中加载
    })
  },

  // ── 以下函数已移至 ai-edit.js ──────────────────────────
  // 保留一个占位避免旧 WXML 调用报错（正常情况不会被调到）
  _drawCanvas() {
    const { canvasLayout, mktgType } = this.data
    const bgUrl = this._bgTempUrl
    if (!bgUrl) { this.setData({ mktgState: 'done' }); return }

    wx.createSelectorQuery()
      .select('#mktgCanvas')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res[0] || !res[0].node) { this.setData({ mktgState: 'done' }); return }
        const canvas = res[0].node
        const ctx    = canvas.getContext('2d')
        const W      = res[0].width
        const H      = res[0].height
        canvas.width  = W
        canvas.height = H

        const img = canvas.createImage()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, W, H)

          // 顶部渐变遮罩
          const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.38)
          topGrad.addColorStop(0, 'rgba(0,0,0,0.75)')
          topGrad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, H * 0.38)

          // 底部渐变遮罩
          const botGrad = ctx.createLinearGradient(0, H * 0.55, 0, H)
          botGrad.addColorStop(0, 'rgba(0,0,0,0)')
          botGrad.addColorStop(1, 'rgba(0,0,0,0.88)')
          ctx.fillStyle = botGrad; ctx.fillRect(0, H * 0.55, W, H * 0.45)

          const pad = W * 0.08
          ctx.textBaseline = 'top'
          ctx.textAlign    = 'left'

          // 顶部：酒馆名（金色）
          ctx.fillStyle = 'rgba(201,169,110,0.95)'
          ctx.font      = `bold ${Math.round(W * 0.042)}px sans-serif`
          ctx.fillText(canvasLayout.shopName || '', pad, H * 0.065)

          // 顶部分隔线
          ctx.strokeStyle = 'rgba(201,169,110,0.45)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(pad, H * 0.125); ctx.lineTo(W - pad, H * 0.125); ctx.stroke()

          // 底部区域
          ctx.textBaseline = 'bottom'

          // 合集名（大标题）
          ctx.fillStyle = '#ffffff'
          ctx.font      = `bold ${Math.round(W * 0.068)}px sans-serif`
          ctx.fillText(canvasLayout.headline || '', pad, H * 0.75)

          // 副标题
          if (canvasLayout.subline) {
            ctx.font      = `${Math.round(W * 0.036)}px sans-serif`
            ctx.fillStyle = 'rgba(255,255,255,0.72)'
            ctx.fillText(canvasLayout.subline, pad, H * 0.81)
          }

          // 酒款列表
          const cocktails = canvasLayout.cocktails || []
          ctx.font      = `${Math.round(W * 0.034)}px sans-serif`
          ctx.fillStyle = 'rgba(255,255,255,0.88)'
          const lineH   = H * 0.038

          if (mktgType === 'menu') {
            // 酒单图：显示名称 + 价格
            cocktails.slice(0, 5).forEach((c, i) => {
              const y = H * 0.855 + i * lineH
              ctx.textAlign = 'left';  ctx.fillText(`• ${c.name}`, pad, y)
              if (c.price) { ctx.textAlign = 'right'; ctx.fillText(`¥${c.price}`, W - pad, y) }
            })
          } else {
            // 海报图：只显示名称
            cocktails.slice(0, 4).forEach((c, i) => {
              ctx.textAlign = 'left'
              ctx.fillText(`• ${c.name}`, pad, H * 0.86 + i * lineH)
            })
          }

          // 导出图片
          const tmpPath = `${wx.env.USER_DATA_PATH}/mktg_${Date.now()}.jpg`
          canvas.toDataURL('image/jpeg', 0.92, (dataUrl) => {
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
            wx.getFileSystemManager().writeFile({
              filePath: tmpPath, data: base64, encoding: 'base64',
              success: () => {
                this.setData({ mktgState: 'done', mktgResult: { ...this.data.mktgResult, localPath: tmpPath } })
              },
              fail: () => this.setData({ mktgState: 'done' }),
            })
          })
        }
        img.onerror = () => this.setData({ mktgState: 'done' })
        img.src = bgUrl
      })
  },

  // 在线编辑：修改文字 → 实时重绘 Canvas
  onLayoutInput(e) {
    const { field, idx } = e.currentTarget.dataset
    const val = e.detail.value
    if (idx !== undefined) {
      // 酒款列表字段（name/price）
      const cocktails = [...this.data.canvasLayout.cocktails]
      cocktails[idx] = { ...cocktails[idx], [field]: val }
      this.setData({ 'canvasLayout.cocktails': cocktails })
    } else {
      this.setData({ [`canvasLayout.${field}`]: val })
    }
    // 防抖重绘
    if (this._canvasTimer) clearTimeout(this._canvasTimer)
    this._canvasTimer = setTimeout(() => this._drawCanvas(), 400)
  },
  _canvasTimer: null,

  onToggleEditPanel() {
    this.setData({ showEditPanel: !this.data.showEditPanel, editingHistoryIdx: -1 })
  },

  // 点击历史图的「编辑」按钮 → 把该历史图设为当前结果，展开编辑面板
  onHistoryEdit(e) {
    const idx = e.currentTarget.dataset.idx
    const img = this.data.historyImgs[idx]
    if (!img) return

    const isPoster = img.imageType === 'poster'

    // 把历史图的 tempUrl 恢复为当前背景 URL，供 _drawCanvas() 使用
    this._bgTempUrl = img.tempUrl || ''

    const updates = {
      showEditPanel:     true,
      editingHistoryIdx: idx,
      // 让 mktg-result-wrap 显示该历史图
      mktgState:  'done',
      mktgResult: {
        bgFileID:  img.fileID  || '',
        bgTempUrl: img.tempUrl || '',
        localPath: '',
      },
      // 根据图片类型恢复 mktgType，以便编辑面板和 Canvas 模式匹配
      mktgType: isPoster ? 'poster' : 'cover',
    }

    // 把历史图对应的风格回填到选择器
    if (isPoster) {
      if (img.style) updates.posterStyle = img.style
    } else {
      if (img.style) updates.imgStyle = img.style
    }

    this.setData(updates)

    // 平滑滚动到编辑面板（延迟让面板先渲染）
    setTimeout(() => {
      wx.createSelectorQuery()
        .select('.edit-panel')
        .boundingClientRect(rect => {
          if (rect) wx.pageScrollTo({ scrollTop: rect.top + wx.getWindowInfo().scrollTop, duration: 300 })
        }).exec()
    }, 150)
  },

  // ════════════════════════════════════════════════════════
  // Step 5: 图片预览 / 保存 / 分享
  // ════════════════════════════════════════════════════════

  // 放大预览（系统原生，支持双指缩放）
  onPreviewImg() {
    const { mktgResult } = this.data
    const url = (mktgResult && (mktgResult.localPath || mktgResult.bgTempUrl)) || ''
    if (!url) return
    wx.previewImage({ urls: [url], current: url })
  },

  // 保存到相册
  onSaveImg() {
    const { mktgResult } = this.data
    const path = mktgResult && (mktgResult.localPath || mktgResult.bgTempUrl)
    if (!path) { wx.showToast({ title: '图片未就绪', icon: 'none' }); return }
    wx.showLoading({ title: '保存中…' })
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => { wx.hideLoading(); wx.showToast({ title: '已保存到相册 ✓', icon: 'success' }) },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({ title: '需要相册权限', content: '请前往「设置」中允许访问相册', showCancel: false })
        } else {
          wx.showToast({ title: '长按图片可保存', icon: 'none', duration: 2500 })
        }
      },
    })
  },

  // 分享给朋友（转发时携带图片）
  onShareImg() {
    const { mktgResult } = this.data
    const path = mktgResult && (mktgResult.localPath || mktgResult.bgTempUrl)
    if (!path) { wx.showToast({ title: '图片未就绪', icon: 'none' }); return }
    // 先保存到本地临时文件，再调分享
    wx.showShareImageMenu({ path })
      .catch(() => {
        // 降级：引导用户长按图片分享
        wx.showToast({ title: '长按图片可转发', icon: 'none', duration: 2500 })
      })
  },

  // 重新生成
  onRegenerate() {
    this._bgTempUrl = ''
    this.setData({ mktgState: 'idle', mktgResult: null, mktgError: '', showEditPanel: false, editingHistoryIdx: -1 })
  },

  // ════════════════════════════════════════════════════════
  // 历史图片：加载、设封面、删除
  // ════════════════════════════════════════════════════════

  _loadTargetImages(targetType, targetId) {
    if (!targetId) return
    this.setData({ historyLoading: true, historyImgs: [] })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageList', targetType, targetId },
    }).then(res => {
      const rows = (res.result && res.result.data) || []
      if (!rows.length) { this.setData({ historyLoading: false }); return }

      // 先用 RDB 缓存填充已有 tempUrl，缺的批量换
      const RDB = require('../../data/myRecipes')
      const missing  = []
      const withUrls = rows.map(r => {
        const cached = RDB.getCachedTempUrl(r.fileID)
        if (!cached) missing.push(r.fileID)
        return { ...r, id: r._id, tempUrl: cached || '' }
      })
      this.setData({ historyImgs: withUrls, historyLoading: false })

      if (!missing.length) return
      wx.cloud.getTempFileURL({ fileList: missing })
        .then(res2 => {
          const urlMap = {}
          ;(res2.fileList || []).forEach(f => {
            if (f.tempFileURL) {
              urlMap[f.fileID] = f.tempFileURL
              RDB.saveTempUrl(f.fileID, f.tempFileURL)
            }
          })
          const updated = this.data.historyImgs.map(r =>
            urlMap[r.fileID] ? { ...r, tempUrl: urlMap[r.fileID] } : r
          )
          this.setData({ historyImgs: updated })
        }).catch(() => {})
    }).catch(() => this.setData({ historyLoading: false }))
  },

  // 生成完成后刷新历史图列表（插入最新一张）
  _refreshHistoryAfterGen(fileID, tempUrl, style, imageType) {
    const isCover = imageType !== 'poster'
    // 如果是封面图，把原来的封面标记取消
    const updated = this.data.historyImgs.map(r =>
      isCover ? { ...r, isCover: false } : r
    )
    const newEntry = {
      _id: '', id: '', fileID, tempUrl, style,
      imageType: imageType || 'cover', isCover,
      createdAt: Date.now(),
    }
    this.setData({ historyImgs: [newEntry, ...updated] })
  },

  // 点击历史图：放大预览
  onHistoryImgTap(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img.tempUrl) return
    wx.previewImage({
      urls:    this.data.historyImgs.map(r => r.tempUrl).filter(Boolean),
      current: img.tempUrl,
    })
  },

  // 设为封面
  onHistorySetCover(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img._id) return

    const target = this.data.mktgMode === 'recipe'
      ? this.data.selectedRecipe : this.data.selectedColl
    if (!target) return

    const targetType = this.data.mktgMode === 'recipe' ? 'recipe' : 'collection'
    const targetId   = target.id

    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageSetCover', imageId: img._id, targetId, targetType },
    }).then(res => {
      if (!res.result || !res.result.success) {
        wx.showToast({ title: '操作失败', icon: 'none' }); return
      }
      // 更新本地列表 isCover
      const updated = this.data.historyImgs.map((r, i) => ({ ...r, isCover: i === idx }))
      this.setData({ historyImgs: updated })
      // 同步更新 RDB coverMap
      const RDB = require('../../data/myRecipes')
      RDB.updateCoverTempUrl(targetId, img.fileID, img.tempUrl)
      wx.showToast({ title: '已设为封面 ✓', icon: 'success' })
    }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  // 删除图片记录
  onHistoryDeleteImg(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img._id) { wx.showToast({ title: '无法删除未保存的图片', icon: 'none' }); return }

    const target   = this.data.mktgMode === 'recipe' ? this.data.selectedRecipe : this.data.selectedColl
    const targetId = target && target.id

    wx.showModal({
      title: '删除图片', content: '删除后不可恢复',
      confirmText: '删除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'imageDelete', imageId: img._id, targetId },
        }).then(res2 => {
          const r = res2.result || {}
          if (!r.success) { wx.showToast({ title: '删除失败', icon: 'none' }); return }
          const remaining = this.data.historyImgs.filter((_, i) => i !== idx)
          this.setData({ historyImgs: remaining })
          // 若删的是封面且还有其他图，把最新一张设为封面（显示更新）
          if (r.wascover && remaining.length > 0) {
            const RDB = require('../../data/myRecipes')
            const first = remaining[0]
            if (first.tempUrl && targetId) RDB.updateCoverTempUrl(targetId, first.fileID, first.tempUrl)
          }
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(() => wx.showToast({ title: '删除失败', icon: 'none' }))
      },
    })
  },

  // ── 图片加载错误处理：tempUrl 过期（403）→ 重新获取 ──────
  // 历史图片 403
  onHistoryImgError(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img.fileID) return
    wx.cloud.getTempFileURL({ fileList: [img.fileID] })
      .then(res => {
        const f = res.fileList && res.fileList[0]
        if (!f || !f.tempFileURL) return
        const RDB = require('../../data/myRecipes')
        RDB.saveTempUrl(img.fileID, f.tempFileURL)
        this.setData({ [`historyImgs[${idx}].tempUrl`]: f.tempFileURL })
        // 如果当前编辑的就是这张图，同步更新 _bgTempUrl 和 mktgResult
        if (this.data.editingHistoryIdx === idx) {
          this._bgTempUrl = f.tempFileURL
          this.setData({ 'mktgResult.bgTempUrl': f.tempFileURL })
        }
      }).catch(() => {})
  },

  // 结果区图片 403
  onResultImgError() {
    const { mktgResult } = this.data
    if (!mktgResult || !mktgResult.bgFileID) return
    wx.cloud.getTempFileURL({ fileList: [mktgResult.bgFileID] })
      .then(res => {
        const f = res.fileList && res.fileList[0]
        if (!f || !f.tempFileURL) return
        this._bgTempUrl = f.tempFileURL
        this.setData({ 'mktgResult.bgTempUrl': f.tempFileURL })
        // 如果是海报模式，重绘 Canvas
        if (this.data.mktgMode === 'collection' && this.data.mktgType !== 'cover') {
          this._drawCanvas()
        }
      }).catch(() => {})
  },

  // 保存历史图到相册
  onHistorySaveImg(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img.tempUrl) { wx.showToast({ title: '图片未加载', icon: 'none' }); return }
    wx.showLoading({ title: '保存中…' })
    wx.saveImageToPhotosAlbum({
      filePath: img.tempUrl,
      success: () => { wx.hideLoading(); wx.showToast({ title: '已保存 ✓', icon: 'success' }) },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({ title: '需要相册权限', content: '请前往设置开启', showCancel: false })
        } else {
          wx.showToast({ title: '长按图片可保存', icon: 'none', duration: 2000 })
        }
      },
    })
  },
})

// ══ 经营分析：绘图函数 ══════════════════════════════════

function analDrawLineChart(ctx, W, H, data) {
  const PAD = { top:20, right:16, bottom:36, left:46 }
  const cW  = W - PAD.left - PAD.right
  const cH  = H - PAD.top  - PAD.bottom
  const n   = data.labels.length
  const fs  = Math.max(10, Math.round(W * 0.034))

  ctx.fillStyle = '#16181f'; ctx.fillRect(0, 0, W, H)

  // 绘制 X 轴标签（无论有无数据都显示）
  ctx.fillStyle = '#5c5b65'; ctx.font = `${fs}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  function toX(i) { return PAD.left + (i / Math.max(n - 1, 1)) * cW }
  for (let i = 0; i < n; i++) ctx.fillText(data.labels[i], toX(i), H - 6)

  // 无营业额数据时显示占位文字，不尝试绘制折线
  const hasRevenue = data.revenue.some(v => v > 0)
  if (!hasRevenue) {
    ctx.fillStyle = '#5c5b65'; ctx.font = `${Math.round(fs * 1.2)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('暂无营业记录', W / 2, PAD.top + cH / 2 - 10)
    ctx.font = `${fs}px sans-serif`
    ctx.fillText('请在首页录入营业额', W / 2, PAD.top + cH / 2 + 12)
    return
  }

  const max = Math.max(...data.revenue, ...data.profit, 1) * 1.15
  function toY(v) { return PAD.top + cH * (1 - v / max) }

  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (cH / 4) * i
    ctx.strokeStyle = '#2a2d38'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
    const v = Math.round(max * (1 - i / 4))
    ctx.fillStyle = '#5c5b65'; ctx.font = `${fs}px sans-serif`
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText(v >= 1000 ? (v/1000).toFixed(1)+'k' : String(v), PAD.left - 6, y)
  }
  function drawLine(vals, lineColor, gradColor) {
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH)
    grad.addColorStop(0, gradColor); grad.addColorStop(1, 'rgba(22,24,31,0)')
    ctx.beginPath(); ctx.moveTo(toX(0), toY(vals[0]))
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
  drawLine(data.profit,  '#4caf84', 'rgba(76,175,132,0.20)')
  drawLine(data.revenue, '#c9a96e', 'rgba(201,169,110,0.20)')
}

function analDrawBarChart(ctx, W, H, data) {
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
