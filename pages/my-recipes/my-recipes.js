// pages/my-recipes/my-recipes.js
// Phase 3：全面接入 recipes 云函数

const RDB = require('../../data/myRecipes')
const { RECIPES: BUILTIN } = require('../../data/recipes')

const FLAVOR_OPTIONS = ['酸爽', '甜蜜', '苦涩', '清爽', '烟熏', '花香', '热带', '草本']
const BASE_OPTIONS   = ['随机', '金酒', '伏特加', '朗姆酒', '龙舌兰', '威士忌', '无酒精']
const BASES_FILTER   = ['全部', '金酒', '伏特加', '朗姆酒', '龙舌兰', '威士忌', '无酒精', '其他']
const PUBLISH_TAGS         = ['果味', '清爽', '低度', '经典', '创意', '烟熏', '花香', '热带', '夏日', '甜蜜', '苦涩', '无酒精']
// 发现页标签预设（CF 加载前的兜底）
const PRESET_FLAVOR_TAGS   = ['全部', '果味', '甜蜜', '清爽', '苦涩', '热带', '烟熏', '花香']
const PRESET_STYLE_TAGS    = ['全部', '低度', '经典', '创意', '夏日', '无酒精']
// 我的 / 收藏页来源维度
const MINE_SOURCE_ORDER    = ['全部', '原创', 'AI生成', '克隆']

const EMPTY_RECIPE_FORM = {
  name:'', emoji:'🍹', base:'', desc:'',
  ingredients:[{ name:'', amount:'' }],
  steps:[''], notes:'',
  isOriginal: false, isAI: false, isClone: false,
}
const EMPTY_COLL_FORM = { name:'', emoji:'📂', desc:'', tags:[] }

function withPreview(r, favIds) {
  const fileID = r.coverFileID || ''
  return {
    ...r,
    ingredientPreview: (r.ingredients || []).slice(0, 3),
    moreCount:         Math.max(0, (r.ingredients || []).length - 3),
    isFav:             !!(favIds && favIds[r._id || r.id]),
    coverFileID:  fileID,
    // coverTempUrl 由 _fetchMissingTempUrls 换新后注入，这里保持原值或空
    coverTempUrl: r.coverTempUrl || '',
  }
}

Page({
  data: {
    tabs: [
      { id:'discover', label:'发现' },
      { id:'mine',     label:'我的' },
      { id:'fav',      label:'收藏' },
    ],
    activeTab:    'discover',
    isLoading:    false,
    showSearch:   false,
    searchText:   '',
    // ── 发现页 ────────────────────────────────────────────
    // 多维过滤状态
    discoverBase:       '全部',
    discoverFlavorTag:  '全部',
    discoverStyleTag:   '全部',
    discoverAIFilter:   '全部',
    // 动态标签池（CF 加载后覆盖预设）
    discoverBaseTags:   ['全部'],
    discoverFlavorTags: PRESET_FLAVOR_TAGS,
    discoverStyleTags:  PRESET_STYLE_TAGS,
    discoverKeyword:    '',
    discoverFilterOpen: false,           // 筛选面板是否展开
    likedPublicIds:     {},
    discoverSubTab:     'recipe',        // 'recipe' | 'collection'
    // 配方子分区
    discoverRecipeList:    [],
    discoverRecipeOffset:  0,
    discoverRecipeHasMore: false,
    discoverRecipeLoading: false,
    // 合集子分区
    discoverCollList:      [],
    discoverCollOffset:    0,
    discoverCollHasMore:   false,
    discoverCollLoading:   false,
    // ── 发布抽屉 ─────────────────────────────────────────
    showPublishDrawer: false,
    publishTarget:     null,          // { id, name, emoji, desc, base, coverFileID, isPublic, publishId }
    publishTags:       [],            // 选中的标签
    publishTagInput:   '',
    publishTagOptions: PUBLISH_TAGS,
    // ── 我的（配方+合集）─────────────────────────────────────
    mineSubTab:        'recipe',   // 'recipe' | 'collection'
    mineFilterOpen:    false,      // 筛选面板是否展开
    mineTags:          ['全部'],   // 基酒
    mineTag:           '全部',
    mineSourceTags:    ['全部'],   // 来源/类型（原创/AI生成/克隆/动态）
    mineSourceTag:     '全部',
    minePubTag:        '全部',     // 是否已公开（固定三选一）
    mineRecipeList:    [],
    mineRecipeHasMore: false,
    mineRecipePage:    15,
    mineCollList:      [],
    mineCollHasMore:   false,
    mineCollPage:      10,
    // ── 收藏（配方+合集）─────────────────────────────────────
    favSubTab:         'recipe',   // 'recipe' | 'collection'
    favFilterOpen:     false,      // 筛选面板是否展开
    favTags:           ['全部'],   // 基酒
    favTag:            '全部',
    favTypeTags:       ['全部'],   // 原创/AI生成
    favTypeTag:        '全部',
    favSourceTags:     ['全部'],   // 内置库/自创
    favSourceTag:      '全部',
    favRecipeList:     [],
    favRecipeHasMore:  false,
    favRecipePage:     15,
    favCollList:       [],
    favCollHasMore:   false,
    favCollPage:      10,
    isTapping: false,
    expandedId:      null,
    expandedCollId:  null,

    // ── 批量选择模式 ─────────────────────────────────────
    batchMode:         false,
    batchSelected:     {},   // { id: true }
    batchCount:        0,
    showCollPicker:    false,
    collPickerList:    [],

    // AI 抽屉
    showAIDrawer:      false,
    aiState:           'input',
    aiForm:            { flavors:[], base:'随机', customPrompt:'' },
    flavorSelectedMap: {},   // { '酸爽': true, ... } 用于 WXML 选中态判断
    aiResult:          null,
    aiErrorMsg:        '',
    aiSaving:          false,
    flavorOptions:     FLAVOR_OPTIONS,
    baseOptions:       BASE_OPTIONS,

    // 配方表单
    showFormDrawer: false,
    formMode:       'add',
    editingId:      null,
    recipeForm:     { ...EMPTY_RECIPE_FORM, ingredients:[{name:'',amount:''}], steps:[''] },
    formError:      '',

    // 合集表单
    showCollForm:  false,
    collFormMode:  'add',
    editingCollId: null,
    collForm:      { ...EMPTY_COLL_FORM },
    collTagOptions: ['果味','清爽','低度','经典','创意','烟熏','花香','热带','夏日','甜蜜','苦涩','无酒精'],

    // 合集营销图（统一：封面图 + 营销海报）
    showCollMktgDrawer:   false,
    collMktgTarget:       null,   // { id, name, emoji, desc, recipes[], coverTempUrl }
    collMktgType:         'cover',  // 'cover' | 'poster'
    collMktgState:        'idle',   // idle | loading | canvas | done | error
    collMktgStyle:        'elegant',
    collMktgPosterStyle:  'luxury',
    collMktgCustomPrompt: '',
    collMktgLoadStep:     '',
    collMktgError:        '',
    collMktgResult:       null,   // { fileID, tempUrl } or { bgFileID, bgTempUrl, localPath }
    collMktgImages:       [],
    collMktgLayout:       { shopName:'', headline:'', subline:'' },
    collMktgTypes: [
      { id:'cover',  emoji:'🖼',  label:'封面图',  desc:'1:1 方图' },
      { id:'poster', emoji:'🎭', label:'营销海报', desc:'3:4 带文字' },
    ],
    posterStyles: [
      { id:'luxury',  label:'奢华金黑', desc:'高端夜店风', emoji:'🖤' },
      { id:'garden',  label:'花园清新', desc:'夏日户外风', emoji:'🌿' },
      { id:'retro',   label:'复古海报', desc:'70年代美式', emoji:'🎞' },
      { id:'minimal', label:'极简白',   desc:'简约菜单风', emoji:'⬜' },
      { id:'neon',    label:'霓虹赛博', desc:'夜店赛博风', emoji:'🌈' },
    ],

    // 合集发布
    showCollPublishDrawer: false,
    collPublishTarget:     null,
    collPublishTags:       [],
    collPublishTagInput:   '',

    // (discoverType 已移除，改为分区展示)

    // ── Step 7: 图片生成 ──────────────────────────────────
    showImgDrawer:   false,
    imgTarget:       null,          // { type, data, recordId, source }
    imgStyle:        'elegant',
    imgCustomPrompt: '',
    imgState:        'idle',        // idle | config | loading | done | error
    imgLoadingStep:  '正在生成描述词…',
    imgResult:       null,          // { fileID, tempUrl, prompt }
    imgErrorMsg:     '',
    imgImages:       [],            // 该 target 的历史图片列表（来自 recipe_images）
    imgStyles: [
      { id:'elegant',    label:'精致暗调', desc:'高级感暗调', emoji:'🥃' },
      { id:'bright',     label:'清新明亮', desc:'Instagram 风', emoji:'☀️' },
      { id:'vintage',    label:'复古胶片', desc:'70年代风格',  emoji:'📷' },
      { id:'minimal',    label:'极简白底', desc:'菜单卡片风',  emoji:'⬜' },
      { id:'neon',       label:'霓虹夜店', desc:'赛博朋克',    emoji:'🌈' },
      { id:'watercolor', label:'水彩插画', desc:'艺术插画风',  emoji:'🎨' },
    ],
  },

  onLoad()  { this._init(); this._loadRecipeConfig() },
  onShow()  {
    // 非首次进入时刷新（避免 onLoad 刚加载完立即 onShow 重复请求）
    if (this._hasLoaded) this._init()
    this._hasLoaded = true
  },

  _hasLoaded: false,

  // ── 加载 AI 配方配置（口味/基酒选项）────────────────────
  _loadRecipeConfig() {
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'getRecipeConfig' },
    }).then(res => {
      const r = (res && res.result) || {}
      if (r.success) {
        this.setData({
          flavorOptions: r.flavorOptions || FLAVOR_OPTIONS,
          baseOptions:   r.baseOptions   || BASE_OPTIONS,
        })
      }
    }).catch(() => {})  // 失败时保持本地默认值
  },

  // ── 初始化：预加载云端数据 ────────────────────────────
  _init() {
    this.setData({ isLoading: true })
    RDB.preload().then(() => {
      this.setData({ isLoading: false })
      this._refresh()
      // 发现页：首次进入时加载
      if (this.data.activeTab === 'discover' && this.data.discoverRecipeList.length === 0) {
        this._loadDiscoverTags()
        this._loadDiscoverRecipes(true)
        this._loadDiscoverColls(true)
      }
      // 拉取已点赞 ID
      wx.cloud.callFunction({ name: 'recipes', data: { action: 'discoverGetLiked' } })
        .then(res => {
          if (res.result && res.result.success) {
            const map = {}
            ;(res.result.likedPublicIds || []).forEach(id => { map[id] = true })
            this.setData({ likedPublicIds: map })
          }
        }).catch(() => {})
    }).catch(() => {
      this.setData({ isLoading: false })
      this._refresh()
    })
  },

  _refresh() {
    const favIds = RDB.getFavIds()
    // 发现页在 _init / tab 切换时按需加载，_refresh 不重置（避免翻页后返回被重置）
    this._renderMine(this.data.searchText, favIds)
    this._renderFav(favIds)
    this._renderColls()
    wx.nextTick(() => this._fetchMissingTempUrls())
  },

  // ── 发现：动态标签热度排序 ─────────────────────────────
  _loadDiscoverTags() {
    wx.cloud.callFunction({ name: 'recipes', data: { action: 'discoverTags' } })
      .then(res => {
        const r = res.result || {}
        if (!r.success) return
        const upd = {}
        if (r.bases      && r.bases.length)      upd.discoverBaseTags   = ['全部', ...r.bases]
        if (r.flavorTags && r.flavorTags.length) upd.discoverFlavorTags = ['全部', ...r.flavorTags]
        if (r.styleTags  && r.styleTags.length)  upd.discoverStyleTags  = ['全部', ...r.styleTags]
        if (Object.keys(upd).length) this.setData(upd)
      }).catch(() => {})
  },

  // ── 发现：配方子分区 ──────────────────────────────────
  _loadDiscoverRecipes(reset) {
    if (!this._discoverRecipeVer) this._discoverRecipeVer = 0
    const ver = ++this._discoverRecipeVer
    if (reset !== false) {
      this.setData({ discoverRecipeList: [], discoverRecipeOffset: 0, discoverRecipeHasMore: false, discoverRecipeLoading: false })
    }
    if (this.data.discoverRecipeLoading) return
    this.setData({ discoverRecipeLoading: true })
    const offset = reset === false ? this.data.discoverRecipeOffset : 0
    wx.cloud.callFunction({
      name: 'recipes',
      data: {
        action:     'discoverList',
        targetType: 'recipe',
        base:       this.data.discoverBase      || '全部',
        flavorTag:  this.data.discoverFlavorTag || '全部',
        styleTag:   this.data.discoverStyleTag  || '全部',
        aiFilter:   this.data.discoverAIFilter  || '全部',
        keyword:    this.data.discoverKeyword   || '',
        offset, limit: 20,
      },
    }).then(res => {
      if (ver !== this._discoverRecipeVer) return
      const r = res.result || {}
      this.setData({ discoverRecipeLoading: false })
      if (!r.success) return
      const favIds = RDB.getFavIds()
      const newList = (r.data || []).map(item => ({
        ...item,
        isFav:   !!(favIds[item._id] || favIds[item.targetId]),
        isLiked: !!(this.data.likedPublicIds[item._id]),
      }))
      const cur = reset === false ? (this.data.discoverRecipeList || []) : []
      this.setData({
        discoverRecipeList:    [...cur, ...newList],
        discoverRecipeHasMore: r.hasMore,
        discoverRecipeOffset:  r.nextOffset,
      })
      wx.nextTick(() => this._fetchDiscoverCoverUrls(newList, cur.length, 'discoverRecipeList'))
    }).catch(() => this.setData({ discoverRecipeLoading: false }))
  },

  // ── 发现：合集子分区 ──────────────────────────────────
  _loadDiscoverColls(reset) {
    if (!this._discoverCollVer) this._discoverCollVer = 0
    const ver = ++this._discoverCollVer
    if (reset !== false) {
      this.setData({ discoverCollList: [], discoverCollOffset: 0, discoverCollHasMore: false, discoverCollLoading: false })
    }
    if (this.data.discoverCollLoading) return
    this.setData({ discoverCollLoading: true })
    const offset = reset === false ? this.data.discoverCollOffset : 0
    wx.cloud.callFunction({
      name: 'recipes',
      data: {
        action:     'discoverList',
        targetType: 'collection',
        base:       this.data.discoverBase      || '全部',
        flavorTag:  this.data.discoverFlavorTag || '全部',
        styleTag:   this.data.discoverStyleTag  || '全部',
        aiFilter:   this.data.discoverAIFilter  || '全部',
        keyword:    this.data.discoverKeyword   || '',
        offset, limit: 20,
      },
    }).then(res => {
      if (ver !== this._discoverCollVer) return
      const r = res.result || {}
      this.setData({ discoverCollLoading: false })
      if (!r.success) return
      const favCollIds = RDB.getFavCollIds()
      const newList = (r.data || []).map(item => ({
        ...item,
        isFavColl: !!(favCollIds[item._id]),
        isLiked:   !!(this.data.likedPublicIds[item._id]),
      }))
      const cur = reset === false ? (this.data.discoverCollList || []) : []
      this.setData({
        discoverCollList:    [...cur, ...newList],
        discoverCollHasMore: r.hasMore,
        discoverCollOffset:  r.nextOffset,
      })
      wx.nextTick(() => this._fetchDiscoverCoverUrls(newList, cur.length, 'discoverCollList'))
    }).catch(() => this.setData({ discoverCollLoading: false }))
  },

  // 换发现页封面图 tempUrl（通用，指定列表 key）
  _fetchDiscoverCoverUrls(newItems, offset, listKey) {
    const needed = new Map()
    newItems.forEach((item, i) => {
      if (item.coverFileID) {
        if (!needed.has(item.coverFileID)) needed.set(item.coverFileID, [])
        needed.get(item.coverFileID).push(offset + i)
      }
    })
    if (!needed.size) return
    wx.cloud.getTempFileURL({ fileList: [...needed.keys()] })
      .then(res => {
        const updates = {}
        ;(res.fileList || []).forEach(f => {
          if (!f.tempFileURL) return
          RDB.saveTempUrl(f.fileID, f.tempFileURL)
          ;(needed.get(f.fileID) || []).forEach(idx => {
            updates[`${listKey}[${idx}].coverTempUrl`] = f.tempFileURL
          })
        })
        if (Object.keys(updates).length) this.setData(updates)
      }).catch(() => {})
  },

  onDiscoverSubTab(e) {
    this.setData({ discoverSubTab: e.currentTarget.dataset.val })
  },

  // ── 发现页：多维过滤 handler ─────────────────────────────
  _discoverReload() {
    this._loadDiscoverRecipes(true)
    this._loadDiscoverColls(true)
  },

  onDiscoverBase(e) {
    this.setData({ discoverBase: e.currentTarget.dataset.val })
    this._discoverReload()
  },
  onDiscoverFlavorTag(e) {
    this.setData({ discoverFlavorTag: e.currentTarget.dataset.val })
    this._discoverReload()
  },
  onDiscoverStyleTag(e) {
    this.setData({ discoverStyleTag: e.currentTarget.dataset.val })
    this._discoverReload()
  },
  onDiscoverAIFilter(e) {
    this.setData({ discoverAIFilter: e.currentTarget.dataset.val })
    this._discoverReload()
  },

  onToggleDiscoverFilter() {
    this.setData({ discoverFilterOpen: !this.data.discoverFilterOpen })
  },

  onDiscoverSearch(e) {
    const keyword = e.detail.value || ''
    this.setData({ discoverKeyword: keyword })
    this._discoverReload()
  },

  onDiscoverClearSearch() {
    this.setData({ discoverKeyword: '' })
    this._discoverReload()
  },

  // 页面级触底 → 派发到当前 Tab 的加载更多
  onReachBottom() {
    const { activeTab, discoverSubTab, mineSubTab, favSubTab } = this.data
    if (activeTab === 'discover') {
      this.onDiscoverLoadMore()
    } else if (activeTab === 'mine') {
      if (mineSubTab === 'recipe') this.onMineRecipeMore()
      else                         this.onMineCollMore()
    } else if (activeTab === 'fav') {
      if (favSubTab === 'recipe') this.onFavRecipeMore()
      else                        this.onFavCollMore()
    }
  },

  onDiscoverLoadMore() {
    if (this.data.discoverSubTab === 'recipe') {
      if (!this.data.discoverRecipeHasMore || this.data.discoverRecipeLoading) return
      this._loadDiscoverRecipes(false)
    } else {
      if (!this.data.discoverCollHasMore || this.data.discoverCollLoading) return
      this._loadDiscoverColls(false)
    }
  },

  onNavToDetail(e) {
    const { type, id, mode } = e.currentTarget.dataset
    if (!id) return
    const modeParam = mode ? `&mode=${mode}` : ''
    wx.navigateTo({ url: `/pages/recipe-detail/recipe-detail?type=${type}&id=${id}${modeParam}` })
  },

  onNavToCollDetail(e) {
    const { type, id, mode } = e.currentTarget.dataset
    if (!id) return
    const modeParam = mode ? `&mode=${mode}` : ''
    wx.navigateTo({ url: `/pages/collection-detail/collection-detail?type=${type}&id=${id}${modeParam}` })
  },

  onLike(e) {
    const { publishid } = e.currentTarget.dataset
    if (!publishid) return
    const liked   = this.data.likedPublicIds
    const isLiked = !!liked[publishid]
    const newLiked = { ...liked }
    if (isLiked) delete newLiked[publishid]; else newLiked[publishid] = true
    this.setData({ likedPublicIds: newLiked })
    const delta = isLiked ? -1 : 1
    const patch = {}
    const ridx = this.data.discoverRecipeList.findIndex(r => r._id === publishid)
    const cidx = this.data.discoverCollList.findIndex(r => r._id === publishid)
    if (ridx >= 0) { patch[`discoverRecipeList[${ridx}].isLiked`] = !isLiked; patch[`discoverRecipeList[${ridx}].likeCount`] = (this.data.discoverRecipeList[ridx].likeCount || 0) + delta }
    if (cidx >= 0) { patch[`discoverCollList[${cidx}].isLiked`]   = !isLiked; patch[`discoverCollList[${cidx}].likeCount`]   = (this.data.discoverCollList[cidx].likeCount   || 0) + delta }
    this.setData(patch)
    wx.cloud.callFunction({ name: 'recipes', data: { action: 'discoverLike', publishId: publishid } })
      .catch(() => {
        this.setData({ likedPublicIds: liked })
        const rb = {}
        if (ridx >= 0) { rb[`discoverRecipeList[${ridx}].isLiked`] = isLiked; rb[`discoverRecipeList[${ridx}].likeCount`] = this.data.discoverRecipeList[ridx].likeCount - delta }
        if (cidx >= 0) { rb[`discoverCollList[${cidx}].isLiked`]   = isLiked; rb[`discoverCollList[${cidx}].likeCount`]   = this.data.discoverCollList[cidx].likeCount   - delta }
        this.setData(rb)
      })
  },

  // ── 发布配方 ─────────────────────────────────────────────
  onPublish(e) {
    const id = e.currentTarget.dataset.id
    const r  = RDB.getMyById(id)
    if (!r) return
    this.setData({
      showPublishDrawer: true,
      publishTarget:     {
        id:          r._id || r.id,
        name:        r.name,
        emoji:       r.emoji || '🍹',
        desc:        r.desc  || '',
        base:        r.base  || '',
        coverFileID: r.coverFileID || '',
        coverTempUrl:r.coverTempUrl || '',
        isPublic:    !!r.isPublic,
        publishId:   r.publishId || null,
      },
      publishTags:  r.isPublic ? [] : [],  // 已发布时可预填之前的标签（暂留空）
      publishTagInput: '',
    })
  },

  onClosePublish() { this.setData({ showPublishDrawer: false }) },

  onTogglePublishTag(e) {
    const val  = e.currentTarget.dataset.val
    const tags = [...this.data.publishTags]
    const idx  = tags.indexOf(val)
    if (idx >= 0) {
      tags.splice(idx, 1)
    } else if (tags.length < 5) {
      tags.push(val)
    } else {
      wx.showToast({ title: '最多选 5 个标签', icon: 'none' })
      return
    }
    this.setData({ publishTags: tags })
  },

  onPublishTagInput(e) { this.setData({ publishTagInput: e.detail.value }) },

  onPublishTagAdd() {
    const val  = (this.data.publishTagInput || '').trim()
    const tags = [...this.data.publishTags]
    if (!val) return
    if (tags.length >= 5) { wx.showToast({ title: '最多选 5 个标签', icon: 'none' }); return }
    if (tags.includes(val)) { wx.showToast({ title: '标签已存在', icon: 'none' }); return }
    tags.push(val)
    this.setData({ publishTags: tags, publishTagInput: '' })
  },

  onPublishTagRemove(e) {
    const idx  = e.currentTarget.dataset.idx
    const tags = [...this.data.publishTags]
    tags.splice(idx, 1)
    this.setData({ publishTags: tags })
  },

  onPublishSubmit() {
    const { publishTarget, publishTags } = this.data
    if (!publishTarget) return
    if (publishTags.length === 0) {
      wx.showToast({ title: '请至少选一个标签', icon: 'none' }); return
    }
    wx.showLoading({ title: '发布中…', mask: true })
    wx.cloud.callFunction({
      name: 'recipes',
      data: {
        action:      'discoverPublish',
        recipeId:    publishTarget.id,
        tags:        publishTags,
        coverFileID: publishTarget.coverFileID || '',
      },
    }).then(res => {
      wx.hideLoading()
      const r = res.result || {}
      if (!r.success) { wx.showToast({ title: r.error || '发布失败', icon: 'none' }); return }
      wx.showToast({ title: r.isUpdate ? '已更新发布 ✓' : '已发布到发现 ✓', icon: 'success' })
      this.setData({ showPublishDrawer: false })
      // 更新本地缓存的 isPublic 状态
      RDB.updateMyRecipe(publishTarget.id, { isPublic: true, publishId: r.publishId })
        .catch(() => {})
      RDB.invalidateCache()
      RDB.preload().then(() => this._renderMine(this.data.searchText, RDB.getFavIds()))
      // 刷新发现页
      if (this.data.activeTab === 'discover') {
        this._loadDiscoverRecipes(true)
        this._loadDiscoverColls(true)
      }
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }) })
  },

  onUnpublish(e) {
    const { id, publishid } = e.currentTarget.dataset
    wx.showModal({
      title: '撤回发布',
      content: '从「发现」页撤回后，其他用户将无法看到此配方',
      confirmText: '确认撤回', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'discoverUnpublish', recipeId: id, publishId: publishid },
        }).then(res2 => {
          if (!res2.result || !res2.result.success) {
            wx.showToast({ title: '撤回失败', icon: 'none' }); return
          }
          wx.showToast({ title: '已撤回', icon: 'success' })
          RDB.updateMyRecipe(id, { isPublic: false, publishId: null }).catch(() => {})
          RDB.invalidateCache()
          RDB.preload().then(() => this._renderMine(this.data.searchText, RDB.getFavIds()))
        }).catch(() => wx.showToast({ title: '网络异常', icon: 'none' }))
      }
    })
  },



  // ── 我的配方（虚拟分页，PAGE=15）───────────────────────
  _renderMine(search, favIds) {
    const PAGE = 15
    favIds = favIds || RDB.getFavIds()
    const raw = RDB.getMyAll()

    // ① 基酒标签：按频率派生
    const baseCounts = {}
    for (const r of raw) {
      const b = r.base || ''
      if (b) baseCounts[b] = (baseCounts[b] || 0) + 1
    }
    const mineTags = ['全部', ...Object.entries(baseCounts).sort((a,b)=>b[1]-a[1]).map(([b])=>b)]

    // ② 来源标签：原创/AI生成/克隆 + 动态 source 字段
    const srcSet = new Set()
    for (const r of raw) {
      if (r.isOriginal) srcSet.add('原创')
      if (r.isAI)       srcSet.add('AI生成')
      if (r.isClone)    srcSet.add('克隆')
      if (r.source)     srcSet.add(r.source)
    }
    const dynamic = Array.from(srcSet).filter(s => !MINE_SOURCE_ORDER.includes(s))
    const mineSourceTags = [...MINE_SOURCE_ORDER.filter(s => s === '全部' || srcSet.has(s)), ...dynamic]

    let all = raw

    // 按基酒过滤
    const tag = this.data.mineTag
    if (tag && tag !== '全部') all = all.filter(r => (r.base || '') === tag)

    // 按来源过滤
    const srcTag = this.data.mineSourceTag
    if (srcTag && srcTag !== '全部') {
      if      (srcTag === '原创')   all = all.filter(r => r.isOriginal)
      else if (srcTag === 'AI生成') all = all.filter(r => r.isAI)
      else if (srcTag === '克隆')   all = all.filter(r => r.isClone)
      else                          all = all.filter(r => r.source === srcTag)
    }

    // 按公开状态过滤
    const pubTag = this.data.minePubTag
    if      (pubTag === '已公开') all = all.filter(r => r.isPublic)
    else if (pubTag === '未公开') all = all.filter(r => !r.isPublic)

    // 文字搜索
    if (search) {
      const q = search.toLowerCase()
      all = all.filter(r =>
        r.name.includes(q) || (r.base||'').includes(q) ||
        (r.ingredients||[]).some(i=>i.name.includes(q))
      )
    }

    this._mineRecipeAll = all.map(r => withPreview(r, favIds))
    this.setData({
      mineTags,
      mineSourceTags,
      mineRecipeList:    this._mineRecipeAll.slice(0, PAGE),
      mineRecipeHasMore: this._mineRecipeAll.length > PAGE,
      mineRecipePage:    PAGE,
    })
  },

  onMineTag(e) {
    this.setData({ mineTag: e.currentTarget.dataset.val })
    this._renderMine(this.data.searchText, RDB.getFavIds())
  },
  onMineSourceTag(e) {
    this.setData({ mineSourceTag: e.currentTarget.dataset.val })
    this._renderMine(this.data.searchText, RDB.getFavIds())
  },
  onMinePubTag(e) {
    this.setData({ minePubTag: e.currentTarget.dataset.val })
    this._renderMine(this.data.searchText, RDB.getFavIds())
  },

  onToggleMineFilter() {
    this.setData({ mineFilterOpen: !this.data.mineFilterOpen })
  },

  onMineSubTab(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ mineSubTab: val, mineFilterOpen: false, batchMode: false, batchSelected: {}, batchCount: 0, mineTag: '全部', mineSourceTag: '全部', minePubTag: '全部' })
  },

  onMineRecipeMore() {
    if (!this.data.mineRecipeHasMore) return
    const all = this._mineRecipeAll || []
    const cur  = this.data.mineRecipeList.length
    const next = cur + 15
    const slice = all.slice(cur, next)
    this.setData({
      mineRecipeList:    [...this.data.mineRecipeList, ...slice],
      mineRecipeHasMore: next < all.length,
      mineRecipePage:    next,
    })
    wx.nextTick(() => this._fetchMissingTempUrls())
  },

  onMineCollMore() {
    if (!this.data.mineCollHasMore) return
    const all = this._mineCollAll || []
    const cur  = this.data.mineCollList.length
    const next = cur + 10
    const slice = all.slice(cur, next)
    this.setData({
      mineCollList:    [...this.data.mineCollList, ...slice],
      mineCollHasMore: next < all.length,
      mineCollPage:    next,
    })
    wx.nextTick(() => this._fetchMissingTempUrls())
  },

  // ── 收藏配方（虚拟分页，PAGE=15）───────────────────────
  _renderFav(favIds) {
    const PAGE = 15
    favIds = favIds || RDB.getFavIds()
    const ids = Object.keys(favIds)
    const raw = []
    ids.forEach(id => {
      const builtin = BUILTIN.find(r => String(r.id) === String(id))
      if (builtin) { raw.push({ ...withPreview(builtin, favIds), source:'builtin' }); return }
      const user = RDB.getMyById(id)
      if (user)    { raw.push({ ...withPreview(user, favIds), source:'user' }) }
    })

    // ① 基酒标签
    const baseCounts = {}
    for (const r of raw) {
      const b = r.base || ''
      if (b) baseCounts[b] = (baseCounts[b] || 0) + 1
    }
    const favTags = ['全部', ...Object.entries(baseCounts).sort((a,b)=>b[1]-a[1]).map(([b])=>b)]

    // ② 类型标签：原创/AI生成
    const typeSet = new Set()
    for (const r of raw) {
      if (r.isOriginal) typeSet.add('原创')
      if (r.isAI)       typeSet.add('AI生成')
    }
    const favTypeTags = ['全部', ...Array.from(typeSet)]

    // ③ 来源标签：内置库/自创
    const srcSet = new Set()
    for (const r of raw) { srcSet.add(r.source === 'builtin' ? '内置库' : '自创') }
    const favSourceTags = ['全部', ...Array.from(srcSet)]

    let all = raw

    const baseTag = this.data.favTag
    if (baseTag && baseTag !== '全部') all = all.filter(r => (r.base || '') === baseTag)

    const typeTag = this.data.favTypeTag
    if      (typeTag === '原创')   all = all.filter(r => r.isOriginal)
    else if (typeTag === 'AI生成') all = all.filter(r => r.isAI)

    const srcTag = this.data.favSourceTag
    if      (srcTag === '内置库') all = all.filter(r => r.source === 'builtin')
    else if (srcTag === '自创')   all = all.filter(r => r.source === 'user')

    this._favRecipeAll = all
    this.setData({
      favTags,
      favTypeTags,
      favSourceTags,
      favRecipeList:    all.slice(0, PAGE),
      favRecipeHasMore: all.length > PAGE,
      favRecipePage:    PAGE,
    })
    this._loadFavColls()
  },

  onFavTag(e) {
    this.setData({ favTag: e.currentTarget.dataset.val })
    this._renderFav(RDB.getFavIds())
  },
  onFavTypeTag(e) {
    this.setData({ favTypeTag: e.currentTarget.dataset.val })
    this._renderFav(RDB.getFavIds())
  },
  onFavSourceTag(e) {
    this.setData({ favSourceTag: e.currentTarget.dataset.val })
    this._renderFav(RDB.getFavIds())
  },

  onToggleFavFilter() {
    this.setData({ favFilterOpen: !this.data.favFilterOpen })
  },

  onFavSubTab(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ favSubTab: val, favFilterOpen: false, batchMode: false, batchSelected: {}, batchCount: 0, favTag: '全部', favTypeTag: '全部', favSourceTag: '全部' })
  },

  onFavRecipeMore() {
    if (!this.data.favRecipeHasMore) return
    const all = this._favRecipeAll || []
    const cur  = this.data.favRecipeList.length
    const next = cur + 15
    const slice = all.slice(cur, next)
    this.setData({
      favRecipeList:    [...this.data.favRecipeList, ...slice],
      favRecipeHasMore: next < all.length,
      favRecipePage:    next,
    })
  },

  // ── 批量选择模式 ────────────────────────────────────────────
  onEnterBatchMode() {
    this.setData({ batchMode: true, batchSelected: {}, batchCount: 0, expandedId: null })
  },

  onExitBatchMode() {
    this.setData({ batchMode: false, batchSelected: {}, batchCount: 0 })
  },

  onBatchToggle(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    const sel = { ...this.data.batchSelected }
    if (sel[id]) delete sel[id]; else sel[id] = true
    this.setData({ batchSelected: sel, batchCount: Object.keys(sel).length })
  },

  onBatchSelectAll() {
    const list = this.data.activeTab === 'mine'
      ? (this.data.mineRecipeList || [])
      : (this.data.favRecipeList  || [])
    const allSelected = this.data.batchCount === list.length
    if (allSelected) {
      this.setData({ batchSelected: {}, batchCount: 0 })
    } else {
      const sel = {}
      list.forEach(r => { sel[r.id || r._id] = true })
      this.setData({ batchSelected: sel, batchCount: list.length })
    }
  },

  onBatchAddToColl() {
    if (this.data.batchCount === 0) return
    const colls = RDB.getCollAll()
    if (colls.length === 0) {
      wx.showModal({
        title: '还没有合集', content: '先创建一个合集？', confirmText: '去创建',
        success: (res) => { if (res.confirm) this.setData({ mineSubTab: 'collection' }) }
      })
      return
    }
    this.setData({ showCollPicker: true, collPickerList: colls })
  },

  onCloseCollPicker() {
    this.setData({ showCollPicker: false })
  },

  onPickCollection(e) {
    const { id } = e.currentTarget.dataset
    const recipeIds = Object.keys(this.data.batchSelected)
    if (!id || !recipeIds.length) return
    this.setData({ showCollPicker: false })
    wx.showLoading({ title: '加入中…', mask: true })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'collBulkAdd', collId: id, recipeIds },
    }).then(res => {
      wx.hideLoading()
      const r = res.result || {}
      if (r.success) {
        wx.showToast({ title: `已加入合集 (${r.added || recipeIds.length})`, icon: 'success' })
        RDB.invalidateCache()
        RDB.preload().then(() => this._renderColls())
        this.setData({ batchMode: false, batchSelected: {}, batchCount: 0 })
      } else {
        wx.showToast({ title: r.error || '操作失败', icon: 'none' })
      }
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }) })
  },

  onBatchDelete() {
    const ids = Object.keys(this.data.batchSelected)
    if (!ids.length) return
    wx.showModal({
      title: `删除 ${ids.length} 条配方`,
      content: '删除后无法恢复',
      confirmText: '删除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中…', mask: true })
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'bulkRemove', ids },
        }).then(res2 => {
          wx.hideLoading()
          const r = res2.result || {}
          if (r.success) {
            wx.showToast({ title: `已删除 ${r.removed || ids.length} 条`, icon: 'success' })
            RDB.invalidateCache()
            return RDB.preload()
          } else {
            wx.showToast({ title: r.error || '删除失败', icon: 'none' })
          }
        }).then(() => {
          const favIds = RDB.getFavIds()
          this._renderMine(this.data.searchText, favIds)
          this._renderFav(favIds)
          this.setData({ batchMode: false, batchSelected: {}, batchCount: 0 })
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }) })
      }
    })
  },

  _loadFavColls() {
    const PAGE = 10
    const favCollIds = RDB.getFavCollIds()
    if (Object.keys(favCollIds).length === 0) {
      this.setData({ favCollList: [], favCollHasMore: false, favCollPage: PAGE })
      return
    }
    wx.cloud.callFunction({ name: 'recipes', data: { action: 'favCollList' } })
      .then(res => {
        const r = res.result || {}
        if (r.success) {
          const all = r.data || []
          this._favCollAll = all
          this.setData({
            favCollList:    all.slice(0, PAGE),
            favCollHasMore: all.length > PAGE,
            favCollPage:    PAGE,
          })
        }
      }).catch(() => {})
  },

  onFavCollMore() {
    if (!this.data.favCollHasMore) return
    const all  = this._favCollAll || []
    const cur  = this.data.favCollList.length
    const next = cur + 10
    this.setData({
      favCollList:    [...this.data.favCollList, ...all.slice(cur, next)],
      favCollHasMore: next < all.length,
      favCollPage:    next,
    })
  },

  // ── 我的合集（虚拟分页，PAGE=10）───────────────────────
  _renderColls() {
    const PAGE   = 10
    const favIds = RDB.getFavIds()
    const all    = RDB.getCollAll().map(c => {
      const recipes = (c.recipes || (c.recipeIds || []).map(rid => {
        const b = BUILTIN.find(r => String(r.id) === String(rid))
        if (b) return withPreview(b, favIds)
        const u = RDB.getMyById(rid)
        return withPreview(u || { id:rid, name:'已删除', ingredients:[], steps:[] }, favIds)
      })).filter(Boolean)
      return {
        ...c,
        id:           c._id || c.id,
        count:        recipes.length,
        recipes,
        coverFileID:  c.coverFileID || '',
        coverTempUrl: c.coverTempUrl || '',
        tags:         c.tags || [],
      }
    })
    this._mineCollAll = all
    this.setData({
      mineCollList:    all.slice(0, PAGE),
      mineCollHasMore: all.length > PAGE,
      mineCollPage:    PAGE,
    })
  },

  // ── Tab ──────────────────────────────────────────────
  onTab(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeTab: id, expandedId: null, expandedCollId: null, searchText: '', showSearch: false, batchMode: false, batchSelected: {}, batchCount: 0 })
    if (id === 'discover' && this.data.discoverRecipeList.length === 0) {
      this._loadDiscoverTags()
      this._loadDiscoverRecipes(true)
      this._loadDiscoverColls(true)
    } else {
      this._refresh()
    }
  },

  onToggleSearch() { this.setData({ showSearch: !this.data.showSearch, searchText: '' }); this._refresh() },
  onSearch(e)      { this.setData({ searchText: e.detail.value }, () => this._refresh()) },
  onClearSearch()  { this.setData({ searchText: '' }, () => this._refresh()) },


  // ── 展开配方 ─────────────────────────────────────────
  onCardTap(e) {
    const { id, source } = e.currentTarget.dataset
    // 批量模式下点击卡片 = 切换选中
    if (this.data.batchMode) {
      const sel = { ...this.data.batchSelected }
      const key = id || (e.currentTarget.dataset.id)
      if (sel[key]) delete sel[key]; else sel[key] = true
      this.setData({ batchSelected: sel, batchCount: Object.keys(sel).length })
      return
    }
    if(this.data.isTapping) return
    this.data.isTapping = true
    if(this.data.isTapping){
      const key = id + '_' + source
      this.setData({ expandedId: this.data.expandedId === key ? null : key })
      setTimeout(() => {
        this.data.isTapping = false
        }, 500);
    }
  },

  // ── 收藏 ─────────────────────────────────────────────
  onToggleFav(e) {
    const { id } = e.currentTarget.dataset
    const isNowFav = RDB.toggleFav(String(id))
    wx.showToast({ title: isNowFav ? '已收藏 ♥' : '已取消收藏', icon:'none', duration:1200 })
    this._refresh()
  },

  // ── 合集收藏 ─────────────────────────────────────────
  onToggleFavColl(e) {
    const { publishid } = e.currentTarget.dataset
    const isNowFav = RDB.toggleFavColl(String(publishid))
    wx.showToast({ title: isNowFav ? '已收藏合集 ♥' : '已取消收藏', icon:'none', duration:1200 })
    // 实时更新发现页合集列表中的 isFavColl 标记
    const cidx = this.data.discoverCollList.findIndex(r => r._id === publishid)
    if (cidx >= 0) this.setData({ [`discoverCollList[${cidx}].isFavColl`]: isNowFav })
    // 如果在收藏 tab，重新拉合集列表
    if (this.data.activeTab === 'fav') this._loadFavColls()
  },

  // ── 克隆内置配方 ─────────────────────────────────────
  onCloneRecipe(e) {
    const src = BUILTIN.find(r => String(r.id) === String(e.currentTarget.dataset.id))
    if (!src) return
    RDB.addMyRecipe({ ...src, id:undefined, isUser:true, isClone:true, isOriginal:false, name: src.name + '（副本）' })
      .then(() => {
        wx.showToast({ title: '已复制到我的配方', icon:'success' })
        return RDB.preload()
      })
      .then(() => this._refresh())
  },

  // ── 复制公开配方到我的配方 ──────────────────────────────
  onClonePublic(e) {
    const { id } = e.currentTarget.dataset
    const src = this.data.discoverRecipeList.find(r => r._id === id)
    if (!src) return
    const payload = {
      name:        src.name + '（来自发现）',
      emoji:       src.emoji || '🍹',
      base:        src.base  || '',
      desc:        src.desc  || '',
      ingredients: src.ingredients || [],
      steps:       src.steps || [],
      notes:       src.notes || '',
      isAI:        !!src.isAI,
      isClone:     true,
      isOriginal:  false,
    }
    RDB.addMyRecipe(payload)
      .then(() => RDB.preload())
      .then(() => {
        wx.showToast({ title: '已复制到我的配方 ✓', icon: 'success' })
        this._renderMine(this.data.searchText, RDB.getFavIds())
      })
      .catch(() => wx.showToast({ title: '复制失败', icon: 'none' }))
  },

  // ── 新增 / 编辑配方 ───────────────────────────────────
  onAddRecipe() {
    this.setData({
      showFormDrawer: true, formMode:'add', editingId: null,
      recipeForm: { ...EMPTY_RECIPE_FORM, ingredients:[{name:'',amount:''}], steps:[''] },
      formError: '',
    })
  },

  onEditRecipe(e) {
    const id = e.currentTarget.dataset.id
    const r  = RDB.getMyById(id)
    if (!r) return
    this.setData({
      showFormDrawer: true, formMode:'edit', editingId: id,
      recipeForm: {
        name:        r.name  || '',
        emoji:       r.emoji || '🍹',
        base:        r.base  || '',
        desc:        r.desc  || '',
        ingredients: r.ingredients && r.ingredients.length ? r.ingredients : [{name:'',amount:''}],
        steps:       r.steps && r.steps.length ? r.steps : [''],
        notes:       r.notes || '',
        isAI:        !!r.isAI,
        isClone:     !!r.isClone,
        isOriginal:  !!r.isOriginal,
      },
      formError: '',
    })
  },

  onCloseForm()      { this.setData({ showFormDrawer: false }) },
  onToggleOriginal() {
    if (this.data.recipeForm.isAI || this.data.recipeForm.isClone) return
    this.setData({ 'recipeForm.isOriginal': !this.data.recipeForm.isOriginal })
  },

  onFormInput(e) {
    this.setData({ [`recipeForm.${e.currentTarget.dataset.field}`]: e.detail.value, formError:'' })
  },
  onIngInput(e) {
    const { idx, field } = e.currentTarget.dataset
    const ings = [...this.data.recipeForm.ingredients]
    ings[idx]  = { ...ings[idx], [field]: e.detail.value }
    this.setData({ 'recipeForm.ingredients': ings })
  },
  onAddIngRow() {
    this.setData({ 'recipeForm.ingredients': [...this.data.recipeForm.ingredients, { name:'', amount:'' }] })
  },
  onDelIngRow(e) {
    const ings = [...this.data.recipeForm.ingredients]
    if (ings.length <= 1) return
    ings.splice(e.currentTarget.dataset.idx, 1)
    this.setData({ 'recipeForm.ingredients': ings })
  },
  onStepInput(e) {
    const steps = [...this.data.recipeForm.steps]
    steps[e.currentTarget.dataset.idx] = e.detail.value
    this.setData({ 'recipeForm.steps': steps })
  },
  onAddStepRow() {
    this.setData({ 'recipeForm.steps': [...this.data.recipeForm.steps, ''] })
  },
  onDelStepRow(e) {
    const steps = [...this.data.recipeForm.steps]
    if (steps.length <= 1) return
    steps.splice(e.currentTarget.dataset.idx, 1)
    this.setData({ 'recipeForm.steps': steps })
  },

  onFormSubmit() {
    const f = this.data.recipeForm
    if (!f.name.trim()) { this.setData({ formError:'名称不能为空' }); return }
    const payload = {
      name:        f.name.trim(),
      emoji:       f.emoji || '🍹',
      base:        (f.base || '').trim(),
      desc:        (f.desc || '').trim(),
      ingredients: f.ingredients.filter(i => i.name.trim()),
      steps:       f.steps.filter(s => s.trim()),
      notes:       (f.notes || '').trim(),
      isOriginal:  !!f.isOriginal,
    }

    const isAdd     = this.data.formMode === 'add'
    const editingId = this.data.editingId

    const promise = isAdd
      ? RDB.addMyRecipe(payload)
      : RDB.updateMyRecipe(editingId, payload)

    promise.then(result => {
      // updateMyRecipe 返回 boolean；false 表示云端更新失败
      if (!isAdd && result === false) {
        wx.showToast({ title: '更新失败，请重试', icon:'none' })
        return Promise.reject(new Error('update returned false'))
      }
      wx.showToast({ title: isAdd ? '配方已保存 ✓' : '已更新 ✓', icon:'success' })
      this.setData({ showFormDrawer: false })
      // 强制让 preload 重新拉云端（绕过 TTL 缓存）
      RDB.invalidateCache()
      return RDB.preload()
    }).then(() => this._refresh())
      .catch(err => {
        if (err && err.message !== 'update returned false') {
          console.error('[onFormSubmit]', err)
          wx.showToast({ title: '保存失败，请重试', icon:'none' })
        }
      })
  },

  // ── 删除配方 ─────────────────────────────────────────
  onDeleteRecipe(e) {
    wx.showModal({
      title:'确认删除', content:'删除后无法恢复',
      confirmText:'删除', confirmColor:'#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        RDB.deleteMyRecipe(e.currentTarget.dataset.id)
          .then(() => RDB.preload())
          .then(() => this._refresh())
          .catch(() => wx.showToast({ title:'删除失败', icon:'none' }))
      }
    })
  },

  // ── 加入合集 ─────────────────────────────────────────
  onAddToCollection(e) {
    const recipeId = String(e.currentTarget.dataset.id)
    const colls    = RDB.getCollAll()
    if (colls.length === 0) {
      wx.showModal({
        title:'还没有合集', content:'先创建一个合集？',
        confirmText:'去创建',
        success: (res) => { if (res.confirm) this.setData({ activeTab:'colls' }); this._refresh() }
      })
      return
    }
    wx.showActionSheet({
      itemList: colls.map(c => c.name),
      success: (res) => {
        const coll = colls[res.tapIndex]
        RDB.addToCollection(coll._id || coll.id, recipeId)
          .then(() => {
            wx.showToast({ title:'已加入合集', icon:'success' })
            return RDB.preload()
          })
          .then(() => this._renderColls())
      }
    })
  },

  // ── 合集 ─────────────────────────────────────────────
  onCollTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedCollId: this.data.expandedCollId === id ? null : id })
  },

  onAddCollection() {
    this.setData({ showCollForm: true, collFormMode:'add', editingCollId: null, collForm: { ...EMPTY_COLL_FORM } })
  },

  onEditCollection(e) {
    const c = RDB.getCollById(e.currentTarget.dataset.id)
    if (!c) return
    this.setData({
      showCollForm: true, collFormMode:'edit', editingCollId: c._id || c.id,
      collForm: { name: c.name, emoji: c.emoji || '📂', desc: c.desc || '', tags: c.tags || [] },
    })
  },

  onDeleteCollection(e) {
    wx.showModal({
      title:'删除合集', content:'仅删除合集，不删除配方本身',
      confirmText:'删除', confirmColor:'#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        RDB.deleteCollection(e.currentTarget.dataset.id)
          .then(() => RDB.preload())
          .then(() => this._renderColls())
      }
    })
  },

  onRemoveFromColl(e) {
    const { collId, recipeId } = e.currentTarget.dataset
    RDB.removeFromCollection(collId, recipeId)
      .then(() => RDB.preload())
      .then(() => this._renderColls())
  },

  onCloseCollForm() { this.setData({ showCollForm: false }) },
  onCollFormInput(e) {
    this.setData({ [`collForm.${e.currentTarget.dataset.field}`]: e.detail.value })
  },
  onToggleCollTag(e) {
    const val  = e.currentTarget.dataset.val
    const tags = [...(this.data.collForm.tags || [])]
    const idx  = tags.indexOf(val)
    if (idx >= 0) tags.splice(idx, 1)
    else if (tags.length < 5) tags.push(val)
    else { wx.showToast({ title: '最多 5 个标签', icon: 'none' }); return }
    this.setData({ 'collForm.tags': tags })
  },
  onCollFormSubmit() {
    if (!this.data.collForm.name.trim()) { wx.showToast({ title:'请填写名称', icon:'none' }); return }
    const isAdd   = this.data.collFormMode === 'add'
    const payload = {
      name:  this.data.collForm.name.trim(),
      emoji: this.data.collForm.emoji || '📂',
      desc:  (this.data.collForm.desc || '').trim(),
      tags:  this.data.collForm.tags || [],
    }
    const promise = isAdd
      ? RDB.addCollection(payload)
      : RDB.updateCollection(this.data.editingCollId, payload)
    promise.then(() => RDB.preload())
      .then(() => { this.setData({ showCollForm: false }); this._renderColls() })
  },

  // ── 每次进页面统一换新 tempUrl ────────────────────────────
  // 不依赖 storage 缓存判断是否过期——每次进页面对所有有 coverFileID 的条目
  // 都重新调 getTempFileURL，确保 URL 永远新鲜，写 storage 供 imgImages 复用
  _fetchMissingTempUrls() {
    const mineRecipeList = this.data.mineRecipeList || []
    const mineCollList   = this.data.mineCollList   || []
    const needed = new Map()  // fileID → [{ list, idx }]
    const add = (fileID, list, idx) => {
      if (!fileID) return
      if (!needed.has(fileID)) needed.set(fileID, [])
      needed.get(fileID).push({ list, idx })
    }
    mineRecipeList.forEach((r, i) => { if (r.coverFileID) add(r.coverFileID, 'mineRecipeList', i) })
    mineCollList.forEach(  (c, i) => { if (c.coverFileID) add(c.coverFileID, 'mineCollList', i) })
    if (!needed.size) return

    wx.cloud.getTempFileURL({ fileList: [...needed.keys()] })
      .then(res => {
        const updates = {}
        ;(res.fileList || []).forEach(f => {
          if (!f.tempFileURL) return
          // 写 storage（供 imgImages 历史列表复用）
          RDB.saveTempUrl(f.fileID, f.tempFileURL)
          // 批量 setData
          ;(needed.get(f.fileID) || []).forEach(({ list, idx }) => {
            updates[`${list}[${idx}].coverTempUrl`] = f.tempFileURL
          })
        })
        if (Object.keys(updates).length) this.setData(updates)
      })
      .catch(() => {})
  },

  // ── 图片生成完成后的处理 ──────────────────────────────────
  _onImageGenDone(targetType, targetId, fileID, tempUrl) {
    if (!targetId || !fileID) return
    RDB.updateCoverTempUrl(targetId, fileID, tempUrl)
    const listKey = targetType === 'collection' ? 'mineCollList' : 'mineRecipeList'
    const list    = this.data[listKey] || []
    const idx     = list.findIndex(x => (x._id || x.id) === targetId)
    if (idx >= 0) {
      this.setData({
        [`${listKey}[${idx}].coverFileID`]:  fileID,
        [`${listKey}[${idx}].coverTempUrl`]: tempUrl,
      })
    }
    this._loadImgHistory()
  },

  // ── 拉取历史图列表 ────────────────────────────────────────
  _loadImgHistory() {
    const { imgTarget } = this.data
    if (!imgTarget || !imgTarget.recordId) { this.setData({ imgImages: [] }); return }
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageList', targetType: imgTarget.type, targetId: imgTarget.recordId },
    }).then(res => {
      const rows = (res.result && res.result.data) || []
      if (!rows.length) { this.setData({ imgImages: [] }); return }
      const missing  = []
      const withUrls = rows.map(r => {
        const cached = RDB.getCachedTempUrl(r.fileID)
        if (!cached) missing.push(r.fileID)
        return { ...r, id: r._id, tempUrl: cached || '' }
      })
      this.setData({ imgImages: withUrls })
      if (!missing.length) return
      wx.cloud.getTempFileURL({ fileList: missing })
        .then(res2 => {
          const urlMap = {}
          ;(res2.fileList || []).forEach(f => {
            if (f.tempFileURL) { urlMap[f.fileID] = f.tempFileURL; RDB.saveTempUrl(f.fileID, f.tempFileURL) }
          })
          const updated = this.data.imgImages.map(r => urlMap[r.fileID] ? { ...r, tempUrl: urlMap[r.fileID] } : r)
          this.setData({ imgImages: updated })
        }).catch(() => {})
    }).catch(() => this.setData({ imgImages: [] }))
  },

  // ── 设为封面 ─────────────────────────────────────────────
  onSetCover(e) {
    const { imageid, targetid, targettype } = e.currentTarget.dataset
    if (!imageid) return
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageSetCover', imageId: imageid, targetId: targetid, targetType: targettype },
    }).then(res => {
      if (!res.result || !res.result.success) return
      const updated = this.data.imgImages.map(r => ({ ...r, isCover: r._id === imageid }))
      this.setData({ imgImages: updated })
      const img = updated.find(r => r._id === imageid)
      if (img && img.tempUrl) {
        this._onImageGenDone(targettype, targetid, img.fileID, img.tempUrl)
        wx.showToast({ title: '已设为封面 ✓', icon: 'success' })
      }
    }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  // ── 删除图片记录 ─────────────────────────────────────────
  onDeleteImg(e) {
    const { imageid, targetid, targettype } = e.currentTarget.dataset
    wx.showModal({
      title: '删除图片', content: '删除后不可恢复',
      confirmText: '删除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'imageDelete', imageId: imageid, targetId: targetid },
        }).then(res2 => {
          const r = res2.result || {}
          if (!r.success) { wx.showToast({ title: '删除失败', icon: 'none' }); return }
          const remaining = this.data.imgImages.filter(x => x._id !== imageid)
          this.setData({ imgImages: remaining })
          if (r.wascover && remaining.length > 0) {
            const first = remaining[0]
            if (first.tempUrl) this._onImageGenDone(targettype, targetid, first.fileID, first.tempUrl)
          } else if (r.wascover) {
            RDB.updateCoverTempUrl(targetid, '', '')
            const listKey = targettype === 'collection' ? 'collList' : 'myList'
            const list    = this.data[listKey] || []
            const idx2    = list.findIndex(x => (x._id || x.id) === targetid)
            if (idx2 >= 0) this.setData({ [`${listKey}[${idx2}].coverTempUrl`]: '', [`${listKey}[${idx2}].coverFileID`]: '' })
          }
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(() => wx.showToast({ title: '删除失败', icon: 'none' }))
      },
    })
  },



  // ── 打开图片生成抽屉：同时记录 recordId 供回写 ─────────
  onOpenImgDrawer(e) {
    const { type, id, source } = e.currentTarget.dataset

    let targetData = null
    if (type === 'recipe') {
      if (source === 'builtin') {
        targetData = BUILTIN.find(r => String(r.id) === String(id))
      } else {
        const raw = RDB.getMyById(id)
        targetData = raw
          ? withPreview(raw, RDB.getFavIds())
          : this.data.discoverRecipeList.find(r => String(r._id || r.id) === String(id))
      }
    } else if (type === 'collection') {
      targetData = (this.data.mineCollList || []).find(c => String(c._id || c.id) === String(id))
    }

    if (!targetData) {
      wx.showToast({ title: '读取数据失败', icon: 'none' })
      return
    }

    // 只有云端自建记录（有 _id）才回写；内置库配方 source=builtin 不回写
    const recordId = (source !== 'builtin') ? (targetData._id || targetData.id || null) : null

    this.setData({
      showImgDrawer:   true,
      imgTarget:       { type, data: targetData, recordId, source: source || '' },
      imgStyle:        'elegant',
      imgCustomPrompt: '',
      imgState:        'config',
      imgResult:       null,
      imgErrorMsg:     '',
      imgLoadingStep:  '正在生成描述词…',
      imgImages:       [],
    })
    // 如果有云端 recordId，立即加载历史图（先从 storage 换 tempUrl）
    if (recordId) {
      wx.nextTick(() => this._loadImgHistory())
    }
  },

  onCloseImgDrawer() {
    // 清理轮询定时器
    if (this._imgPollTimer) {
      clearTimeout(this._imgPollTimer)
      this._imgPollTimer = null
    }
    this.setData({ showImgDrawer: false, imgState: 'idle' })
  },

  onImgStyleTap(e) {
    this.setData({ imgStyle: e.currentTarget.dataset.id })
  },

  onImgCustomInput(e) {
    this.setData({ imgCustomPrompt: e.detail.value })
  },

  // 开始生成：两步调用云函数
  onGenImageStart() {
    const { imgTarget, imgStyle, imgCustomPrompt } = this.data
    if (!imgTarget || imgTarget === 'loading' || imgTarget === 'polling') return

    this.setData({ imgState: 'loading', imgLoadingStep: '正在生成描述词…', imgErrorMsg: '' })

    // Step A: 先让 Claude 生成专业 prompt
    wx.cloud.callFunction({
      name: 'imagegen',
      data: {
        action:       'buildPrompt',
        type:         imgTarget.type,
        data:         imgTarget.data,
        style:        imgStyle,
        customPrompt: imgCustomPrompt,
      },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) {
        this.setData({ imgState: 'error', imgErrorMsg: r.error || '描述词生成失败' })
        return
      }

      this.setData({ imgLoadingStep: '正在渲染图片…' })

      // Step B: 用 prompt 调豆包 Seedream（同步返回，不需要轮询）
      const nameHint = (imgTarget.data.name || 'img').replace(/\s+/g, '_').slice(0, 20)
      wx.cloud.callFunction({
        name: 'imagegen',
        data: {
          action:     'genImage',
          prompt:     r.prompt,
          negPrompt:  r.negPrompt || '',
          style:      imgStyle,
          nameHint,
          // 让云函数在同一次调用内写入 recipe_images 集合
          targetType: imgTarget.type,
          targetId:   imgTarget.recordId || '',
        },
      }).then(res2 => {
        const r2 = res2.result || {}

        if (r2.success && r2.status === 'done') {
          // 1. 更新抽屉显示
          this.setData({
            imgState:  'done',
            imgResult: {
              fileID:  r2.fileID,
              tempUrl: r2.tempUrl,
              prompt:  r.prompt ? r.prompt.slice(0, 60) : '',
            },
          })
          // 2. 更新内存 coverMap + storage + 刷新列表
          //    imagegen 云函数已在同一次调用内写好 recipe_images 集合
          const { recordId, type } = imgTarget
          if (recordId) {
            this._onImageGenDone(type, recordId, r2.fileID, r2.tempUrl)
          }
        } else {
          this.setData({
            imgState:   'error',
            imgErrorMsg: r2.error || '图片生成失败，请重试',
          })
        }
      }).catch(err => {
        console.error('[genImage]', err)
        this.setData({ imgState: 'error', imgErrorMsg: '生图请求失败，请检查网络' })
      })
    }).catch(err => {
      console.error('[buildPrompt]', err)
      this.setData({ imgState: 'error', imgErrorMsg: '描述词生成失败，请重试' })
    })
  },

  // 轮询 Replicate 任务状态（每 2 秒，最多 30 次 = 60 秒）
  _imgPollTimer: null,
  _startImgPoll(predictionId, nameHint, promptText) {
    let count = 0
    const poll = () => {
      count++
      if (count > 30) {
        this.setData({ imgState: 'error', imgErrorMsg: '生成超时，请换个风格重试' })
        return
      }
      this._imgPollTimer = setTimeout(() => {
        wx.cloud.callFunction({
          name: 'imagegen',
          data: { action: 'pollStatus', predictionId, nameHint },
        }).then(res => {
          const r = res.result || {}
          if (r.success && r.status === 'done') {
            this.setData({
              imgState:  'done',
              imgResult: {
                fileID:  r.fileID,
                tempUrl: r.tempUrl,
                prompt:  promptText.slice(0, 60),
              },
            })
          } else if (r.status === 'failed') {
            this.setData({ imgState: 'error', imgErrorMsg: '图片生成失败，请换个风格重试' })
          } else {
            poll()  // 继续轮询
          }
        }).catch(() => poll())  // 网络抖动继续重试
      }, 2000)
    }
    poll()
  },

  // 保存图片到相册
  onSaveToAlbum() {
    const { imgResult } = this.data
    if (!imgResult || !imgResult.tempUrl) {
      wx.showToast({ title: '图片未加载完成', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中…' })
    wx.saveImageToPhotosAlbum({
      filePath: imgResult.tempUrl,
      success: () => {
        wx.hideLoading()
        wx.showToast({ title: '已保存到相册 ✓', icon: 'success', duration: 2000 })
      },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请前往手机「设置」中允许访问相册',
            showCancel: false,
          })
        } else {
          // 长按图片也可保存，给用户提示
          wx.showToast({ title: '长按图片可保存 / 分享', icon: 'none', duration: 2500 })
        }
      },
    })
  },

  // 重新生成：回到配置态
  onRegenerateImage() {
    if (this._imgPollTimer) {
      clearTimeout(this._imgPollTimer)
      this._imgPollTimer = null
    }
    this.setData({ imgState: 'config', imgResult: null, imgErrorMsg: '' })
  },

  // ── AI 创建配方 ───────────────────────────────────────
  onAICreate() {
    this.setData({
      showAIDrawer:      true,
      aiState:           'input',
      aiForm:            { flavors:[], base:'随机', customPrompt:'' },
      flavorSelectedMap: {},
      aiResult:          null,
      aiErrorMsg:        '',
      aiSaving:          false,
    })
  },
  onCloseAI()   { this.setData({ showAIDrawer: false }) },
  // ══ 合集营销图（统一入口）════════════════════════════════

  onOpenCollMktg(e) {
    const id = e.currentTarget.dataset.id
    const c  = (this.data.mineCollList || []).find(x => (x._id || x.id) === id)
    if (!c) return
    const collId   = c._id || c.id
    const shopName = (getApp().globalData && getApp().globalData.shopName) || '我的酒吧'
    this.setData({
      showCollMktgDrawer:   true,
      collMktgTarget:       {
        id:           collId,
        name:         c.name,
        emoji:        c.emoji  || '📂',
        desc:         c.desc   || '',
        coverTempUrl: c.coverTempUrl || '',
        recipes:      (c.recipes || []).slice(0, 6).map(r => ({ name: r.name, emoji: r.emoji || '🍹' })),
      },
      collMktgType:         'cover',
      collMktgState:        'idle',
      collMktgStyle:        'elegant',
      collMktgPosterStyle:  'luxury',
      collMktgCustomPrompt: '',
      collMktgError:        '',
      collMktgResult:       null,
      collMktgImages:       [],
      collMktgLayout: {
        shopName,
        headline: c.name,
        subline:  c.desc || '',
      },
    })
    wx.nextTick(() => this._loadCollMktgHistory(collId))
  },

  onCloseCollMktg() {
    this.setData({ showCollMktgDrawer: false, collMktgState: 'idle' })
  },

  onCollMktgTypeSwitch(e) {
    this.setData({
      collMktgType:   e.currentTarget.dataset.type,
      collMktgState:  'idle',
      collMktgResult: null,
      collMktgError:  '',
    })
  },

  onCollMktgStyleTap(e)       { this.setData({ collMktgStyle:       e.currentTarget.dataset.id }) },
  onCollMktgPosterStyleTap(e) { this.setData({ collMktgPosterStyle: e.currentTarget.dataset.id }) },
  onCollMktgCustomInput(e)    { this.setData({ collMktgCustomPrompt: e.detail.value }) },
  onCollMktgLayoutInput(e) {
    this.setData({ [`collMktgLayout.${e.currentTarget.dataset.field}`]: e.detail.value })
  },

  _loadCollMktgHistory(targetId) {
    if (!targetId) return
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageList', targetType: 'collection', targetId },
    }).then(res => {
      const r    = res.result || {}
      const list = (r.success && r.data) ? r.data : []
      if (!list.length) { this.setData({ collMktgImages: [] }); return }
      const fileIDs = list.map(img => img.fileID).filter(Boolean)
      wx.cloud.getTempFileURL({ fileList: fileIDs }).then(tres => {
        const urlMap = {}
        ;(tres.fileList || []).forEach(f => { if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
        this.setData({ collMktgImages: list.map(img => ({ ...img, tempUrl: urlMap[img.fileID] || '' })) })
      }).catch(() => this.setData({ collMktgImages: list }))
    }).catch(() => {})
  },

  onGenCollMktg() {
    const { collMktgType } = this.data
    if (collMktgType === 'cover') this._genCollMktgCover()
    else                          this._genCollMktgPoster()
  },

  _genCollMktgCover() {
    const { collMktgTarget, collMktgStyle, collMktgCustomPrompt } = this.data
    if (!collMktgTarget) return
    this.setData({ collMktgState: 'loading', collMktgLoadStep: '正在生成描述词…', collMktgError: '' })
    wx.cloud.callFunction({
      name: 'imagegen',
      data: { action: 'buildPrompt', type: 'collection', data: collMktgTarget, style: collMktgStyle, customPrompt: collMktgCustomPrompt },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) { this.setData({ collMktgState: 'error', collMktgError: r.error || '描述词生成失败' }); return }
      this.setData({ collMktgLoadStep: '正在渲染图片…' })
      wx.cloud.callFunction({
        name: 'imagegen',
        data: {
          action:     'genImage',
          prompt:     r.prompt,
          style:      collMktgStyle,
          nameHint:   collMktgTarget.name.slice(0, 12),
          targetType: 'collection',
          targetId:   collMktgTarget.id,
        },
      }).then(res2 => {
        const r2 = res2.result || {}
        if (!r2.success) { this.setData({ collMktgState: 'error', collMktgError: r2.error || '图片生成失败' }); return }
        this.setData({ collMktgState: 'done', collMktgResult: { fileID: r2.fileID, tempUrl: r2.tempUrl } })
        this._onImageGenDone('collection', collMktgTarget.id, r2.fileID, r2.tempUrl)
        this._loadCollMktgHistory(collMktgTarget.id)
      }).catch(() => this.setData({ collMktgState: 'error', collMktgError: '网络异常，请重试' }))
    }).catch(() => this.setData({ collMktgState: 'error', collMktgError: '描述词生成失败，请重试' }))
  },

  _genCollMktgPoster() {
    const { collMktgTarget, collMktgPosterStyle, collMktgCustomPrompt } = this.data
    if (!collMktgTarget) return
    this.setData({ collMktgState: 'loading', collMktgLoadStep: '正在生成背景描述…', collMktgError: '' })
    wx.cloud.callFunction({
      name: 'imagegen',
      data: { action: 'buildPosterPrompt', data: collMktgTarget, posterStyle: collMktgPosterStyle, customPrompt: collMktgCustomPrompt },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) { this.setData({ collMktgState: 'error', collMktgError: r.error || '描述生成失败' }); return }
      this.setData({ collMktgLoadStep: '正在渲染海报背景…' })
      wx.cloud.callFunction({
        name: 'imagegen',
        data: {
          action:      'genPoster',
          prompt:      r.prompt,
          size:        r.size || '768x1024',
          posterStyle: collMktgPosterStyle,
          targetId:    collMktgTarget.id,
          nameHint:    collMktgTarget.name.slice(0, 12),
        },
      }).then(res2 => {
        const r2 = res2.result || {}
        if (!r2.success) { this.setData({ collMktgState: 'error', collMktgError: r2.error || '背景图生成失败' }); return }
        this.setData({ collMktgState: 'canvas', collMktgResult: { bgFileID: r2.fileID, bgTempUrl: r2.tempUrl } })
        wx.nextTick(() => this._drawCollMktgCanvas())
      }).catch(() => this.setData({ collMktgState: 'error', collMktgError: '网络异常，请重试' }))
    }).catch(() => this.setData({ collMktgState: 'error', collMktgError: '描述生成失败，请重试' }))
  },

  _drawCollMktgCanvas() {
    const { collMktgResult, collMktgLayout, collMktgTarget } = this.data
    if (!collMktgResult || !collMktgResult.bgTempUrl) return
    const query = wx.createSelectorQuery()
    query.select('#collMktgCanvas').fields({ node: true, size: true })
    query.exec((res) => {
      if (!res[0] || !res[0].node) { this.setData({ collMktgState: 'done' }); return }
      const canvas = res[0].node
      const ctx    = canvas.getContext('2d')
      const W      = res[0].width  || 360
      const H      = res[0].height || 480
      canvas.width  = W
      canvas.height = H
      const img = canvas.createImage()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, W, H)
        const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.45)
        topGrad.addColorStop(0, 'rgba(0,0,0,0.72)')
        topGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, H * 0.45)
        const botGrad = ctx.createLinearGradient(0, H * 0.55, 0, H)
        botGrad.addColorStop(0, 'rgba(0,0,0,0)')
        botGrad.addColorStop(1, 'rgba(0,0,0,0.82)')
        ctx.fillStyle = botGrad; ctx.fillRect(0, H * 0.55, W, H * 0.45)
        const pad = W * 0.08
        ctx.fillStyle    = 'rgba(201,169,110,0.9)'
        ctx.font         = `bold ${Math.round(W * 0.04)}px sans-serif`
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(collMktgLayout.shopName || '', pad, H * 0.07)
        ctx.strokeStyle = 'rgba(201,169,110,0.5)'
        ctx.lineWidth   = 1
        ctx.beginPath(); ctx.moveTo(pad, H * 0.12); ctx.lineTo(W - pad, H * 0.12); ctx.stroke()
        ctx.fillStyle    = '#ffffff'
        ctx.font         = `bold ${Math.round(W * 0.065)}px sans-serif`
        ctx.textBaseline = 'bottom'
        ctx.fillText(collMktgLayout.headline || '', pad, H * 0.76)
        if (collMktgLayout.subline) {
          ctx.font      = `${Math.round(W * 0.035)}px sans-serif`
          ctx.fillStyle = 'rgba(255,255,255,0.7)'
          ctx.fillText(collMktgLayout.subline, pad, H * 0.82)
        }
        const names = (collMktgTarget.recipes || []).slice(0, 4).map(r => r.name)
        ctx.font      = `${Math.round(W * 0.032)}px sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        names.forEach((name, i) => { ctx.fillText(`• ${name}`, pad, H * 0.87 + i * (H * 0.032)) })
        const fs      = wx.getFileSystemManager()
        const tmpPath = `${wx.env.USER_DATA_PATH}/collmktg_${Date.now()}.jpg`
        canvas.toDataURL('image/jpeg', 0.92, (dataUrl) => {
          const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
          fs.writeFile({
            filePath: tmpPath, data: base64, encoding: 'base64',
            success: () => this.setData({ collMktgState: 'done', collMktgResult: { ...this.data.collMktgResult, localPath: tmpPath } }),
            fail:    () => this.setData({ collMktgState: 'done' }),
          })
        })
      }
      img.onerror = () => this.setData({ collMktgState: 'done' })
      img.src = collMktgResult.bgTempUrl
    })
  },

  onCollMktgSave() {
    const { collMktgResult, collMktgType } = this.data
    const path = collMktgType === 'cover'
      ? (collMktgResult && collMktgResult.tempUrl)
      : (collMktgResult && (collMktgResult.localPath || collMktgResult.bgTempUrl))
    if (!path) { wx.showToast({ title: '图片未就绪', icon: 'none' }); return }
    wx.showLoading({ title: '保存中…' })
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => { wx.hideLoading(); wx.showToast({ title: '已保存到相册 ✓', icon: 'success' }) },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({ title: '需要相册权限', content: '请前往设置开启', showCancel: false })
        } else {
          wx.showToast({ title: '长按图片可保存', icon: 'none', duration: 2500 })
        }
      },
    })
  },

  onCollMktgRegenerate() {
    this.setData({ collMktgState: 'idle', collMktgResult: null, collMktgError: '' })
  },

  onSetCollMktgCover(e) {
    const { imageid, targetid } = e.currentTarget.dataset
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageSetCover', imageId: imageid, targetId: targetid, targetType: 'collection' },
    }).then(res => {
      if (!(res.result && res.result.success)) { wx.showToast({ title: '操作失败', icon: 'none' }); return }
      wx.showToast({ title: '已设为封面 ✓', icon: 'success' })
      const img = (this.data.collMktgImages || []).find(i => i._id === imageid)
      if (img) this._onImageGenDone('collection', targetid, img.fileID, img.tempUrl)
      this._loadCollMktgHistory(targetid)
    })
  },

  onDeleteCollMktgImg(e) {
    const { imageid, targetid } = e.currentTarget.dataset
    wx.showModal({ title: '删除图片', content: '确定删除这张图片？', success: (res) => {
      if (!res.confirm) return
      wx.cloud.callFunction({
        name: 'recipes',
        data: { action: 'imageDelete', imageId: imageid },
      }).then(() => {
        wx.showToast({ title: '已删除', icon: 'success' })
        this._loadCollMktgHistory(targetid)
      })
    }})
  },

  // ══ 合集发布到发现 ════════════════════════════════════════

  onCollPublish(e) {
    const id = e.currentTarget.dataset.id
    const c  = (this.data.mineCollList || []).find(x => (x._id || x.id) === id)
    if (!c) return
    this.setData({
      showCollPublishDrawer: true,
      collPublishTarget: {
        id:          c._id || c.id,
        name:        c.name,
        emoji:       c.emoji || '📂',
        desc:        c.desc  || '',
        coverTempUrl:c.coverTempUrl || '',
        isPublic:    !!c.isPublic,
        publishId:   c.publishId || null,
        posterFileID:(this.data.posterResult && this.data.posterResult.bgFileID) || '',
      },
      collPublishTags:     c.tags || [],
      collPublishTagInput: '',
    })
  },

  onCloseCollPublish() { this.setData({ showCollPublishDrawer: false }) },

  onToggleCollPublishTag(e) {
    const val  = e.currentTarget.dataset.val
    const tags = [...this.data.collPublishTags]
    const idx  = tags.indexOf(val)
    if (idx >= 0) tags.splice(idx, 1)
    else if (tags.length < 5) tags.push(val)
    else { wx.showToast({ title: '最多 5 个标签', icon: 'none' }); return }
    this.setData({ collPublishTags: tags })
  },

  onCollPublishTagInput(e) { this.setData({ collPublishTagInput: e.detail.value }) },

  onCollPublishTagAdd() {
    const val  = (this.data.collPublishTagInput || '').trim()
    const tags = [...this.data.collPublishTags]
    if (!val) return
    if (tags.length >= 5) { wx.showToast({ title: '最多 5 个标签', icon: 'none' }); return }
    if (tags.includes(val)) return
    tags.push(val)
    this.setData({ collPublishTags: tags, collPublishTagInput: '' })
  },

  onCollPublishTagRemove(e) {
    const tags = [...this.data.collPublishTags]
    tags.splice(e.currentTarget.dataset.idx, 1)
    this.setData({ collPublishTags: tags })
  },

  onCollPublishSubmit() {
    const { collPublishTarget, collPublishTags } = this.data
    if (!collPublishTarget) return
    if (!collPublishTags.length) { wx.showToast({ title: '请至少选一个标签', icon: 'none' }); return }
    wx.showLoading({ title: '发布中…', mask: true })
    wx.cloud.callFunction({
      name: 'recipes',
      data: {
        action:       'collPublish',
        collId:       collPublishTarget.id,
        tags:         collPublishTags,
        posterFileID: collPublishTarget.posterFileID || '',
      },
    }).then(res => {
      wx.hideLoading()
      const r = res.result || {}
      if (!r.success) { wx.showToast({ title: r.error || '发布失败', icon: 'none' }); return }
      wx.showToast({ title: r.isUpdate ? '已更新发布 ✓' : '已发布到发现 ✓', icon: 'success' })
      this.setData({ showCollPublishDrawer: false })
      RDB.updateCollection(collPublishTarget.id, { isPublic: true, publishId: r.publishId })
        .catch(() => {})
      RDB.invalidateCache()
      RDB.preload().then(() => this._renderColls())
      if (this.data.activeTab === 'discover') {
        this._loadDiscoverRecipes(true)
        this._loadDiscoverColls(true)
      }
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }) })
  },

  onCollUnpublish(e) {
    const { id, publishid } = e.currentTarget.dataset
    wx.showModal({
      title: '撤回发布', content: '从「发现」页撤回后，其他用户将无法看到此合集',
      confirmText: '确认撤回', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'collUnpublish', collId: id, publishId: publishid },
        }).then(res2 => {
          if (!res2.result || !res2.result.success) {
            wx.showToast({ title: '撤回失败', icon: 'none' }); return
          }
          wx.showToast({ title: '已撤回', icon: 'success' })
          RDB.updateCollection(id, { isPublic: false, publishId: null }).catch(() => {})
          RDB.invalidateCache()
          RDB.preload().then(() => this._renderColls())
        }).catch(() => wx.showToast({ title: '网络异常', icon: 'none' }))
      },
    })
  },

  // ══ 克隆公开合集 ══════════════════════════════════════════

  onClonePublicColl(e) {
    const { publishid } = e.currentTarget.dataset
    wx.showModal({
      title: '复制合集',
      content: '将此合集及其中的配方复制到「我的合集」',
      confirmText: '复制',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '复制中…', mask: true })
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'collClone', publishId: publishid },
        }).then(res2 => {
          wx.hideLoading()
          const r = res2.result || {}
          if (!r.success) {
            wx.showToast({ title: r.error === 'cannot_clone_own' ? '不能复制自己的合集' : '复制失败', icon: 'none' })
            return
          }
          wx.showToast({ title: `已复制 ${r.recipeCount} 款配方 ✓`, icon: 'success' })
          RDB.invalidateCache()
          RDB.preload().then(() => this._renderColls())
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }) })
      },
    })
  },

  // 收藏合集卡片中的"复制合集"（复用 onClonePublicColl 逻辑）
  onCloneCollPublic(e) { this.onClonePublicColl(e) },

  stopProp()    {},

  onToggleFlavor(e) {
    const val     = e.currentTarget.dataset.val
    const flavors = [...this.data.aiForm.flavors]
    const idx     = flavors.indexOf(val)
    if (idx >= 0) {
      flavors.splice(idx, 1)
    } else {
      flavors.push(val)
    }
    // 同步更新扁平 map，供 WXML 直接读取（避免 indexOf 响应式问题）
    const map = {}
    flavors.forEach(f => { map[f] = true })
    this.setData({ 'aiForm.flavors': flavors, flavorSelectedMap: map })
  },
  onSelectBase(e) { this.setData({ 'aiForm.base': e.currentTarget.dataset.val }) },
  onAICustomPrompt(e) { this.setData({ 'aiForm.customPrompt': e.detail.value }) },
  onAIRetry()     { this.setData({ aiState:'input' }) },

  onAIGenerate() {
    const { flavors, base, customPrompt } = this.data.aiForm
    this.setData({ aiState:'loading', aiResult:null, aiErrorMsg:'' })

    wx.cloud.callFunction({
      name: 'recipes',
      data: { action:'aiGenerate', flavors, base: base||'随机', customPrompt: customPrompt||'' },
    }).then(res => {
      const r = res.result || {}
      if (r.success && r.recipe) {
        this.setData({ aiState:'result', aiResult: r.recipe })
      } else if (r.error === 'quota_exceeded') {
        this.setData({ aiState:'error', aiErrorMsg:`本月 AI 配方次数已用完（${r.quotaLimit}次/月）` })
      } else {
        this.setData({ aiState:'error', aiErrorMsg:'AI 生成失败，请稍后重试' })
      }
    }).catch(() => {
      this.setData({ aiState:'error', aiErrorMsg:'网络异常，请检查连接后重试' })
    })
  },

  onAISave() {
    const r = this.data.aiResult
    if (!r || this.data.aiSaving) return
    this.setData({ aiSaving: true })
    wx.showLoading({ title: '保存中…', mask: true })
    RDB.addMyRecipe({ ...r, isAI: true })
      .then(() => RDB.preload())
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已保存到我的配方 ✓', icon: 'success' })
        this.setData({ showAIDrawer: false, activeTab: 'mine', aiSaving: false })
        this._refresh()
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
        this.setData({ aiSaving: false })
      })
  },
})