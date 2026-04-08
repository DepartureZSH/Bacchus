// pages/collection-detail/collection-detail.js
// 合集详情页：公开合集完整展示 + 互动（点赞/评论/评分/贴标签）
// 进入方式：
//   type=public  → 从发现页、收藏页或已发布的我的合集进入（mode=view，互动全开）
//   type=mine    → 从未发布的我的合集进入（mode=preview，互动禁用）

const RDB = require('../../data/myRecipes')

const RATING_CHART_MIN = 5   // 评分人数达到此数才显示评分分布图
const TAG_CLOUD_MIN    = 3   // 标签投票人数达到此数才显示标签云

const TAG_OPTIONS = [
  '果味', '清爽', '低度', '经典', '创意', '烟熏',
  '花香', '热带', '夏日', '甜蜜', '苦涩', '无酒精',
  '易上手', '颜值高', '层次感', '清淡', '浓郁', '适合约会',
]

const RATING_LABELS = ['一般般', '还可以', '不错哦', '很喜欢', '太完美了']

Page({
  data: {
    isLoading: true,
    type: 'public',   // 'public' | 'mine'
    mode: 'view',     // 'view' | 'preview'
    collection: null,

    // 图片轮播
    images:     [],
    imageIdx:   0,
    heroHeight: 680,   // rpx，由 _computeHeroHeight 动态更新

    // 公开互动数据
    publicId:   '',
    authorName: '',
    likeCount:  0,
    isLiked:    false,
    isFav:      false,

    // 展开的配方 id
    expandedRecipeId: '',

    // 评分
    ratingAvg:       '0.0',
    ratingCount:     0,
    ratingDist:      {},
    ratingBars:      [],
    showRatingChart: false,
    myRating:        0,
    pendingRating:   0,
    showRatingInput: false,

    // 标签投票
    tagVotes:     {},
    tagCloudItems:[],
    showTagCloud: false,
    myTags:       [],
    pendingTags:  [],
    showTagInput: false,
    tagOptions:   TAG_OPTIONS,

    // 评论
    commentCount:    0,
    comments:        [],
    commentHasMore:  false,
    commentLastId:   null,
    commentLoading:  false,
    newComment:      '',
    showCommentInput:false,

    ratingLabels: RATING_LABELS,
  },

  onLoad(options) {
    const { id, type = 'public', mode = 'view' } = options
    this.setData({ type, mode })
    if (type === 'public') {
      this._loadPublic(id)
    } else {
      this._loadPreview(id)
    }
  },

  // ── 加载公开合集详情 ──────────────────────────────────────
  _loadPublic(publicId) {
    this.setData({ isLoading: true })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'detailGet', publicId },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) {
        this.setData({ isLoading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        return
      }
      const collection = r.recipe || {}  // public_recipes 文档，合集类型
      wx.setNavigationBarTitle({ title: collection.name || '合集详情' })

      const favIds = RDB.getFavIds()
      const isFav  = !!(favIds[publicId] || favIds[collection.targetId])

      this.setData({
        isLoading:    false,
        publicId,
        collection,
        authorName:   collection.authorName || '酒吧',
        likeCount:    collection.likeCount  || 0,
        isLiked:      !!r.isLiked,
        isFav,
        myRating:     r.myRating     || 0,
        pendingRating:r.myRating     || 0,
        myTags:       r.myTags       || [],
        pendingTags:  r.myTags       || [],
        comments:     r.comments     || [],
        commentHasMore: !!r.commentHasMore,
        commentLastId:  r.commentLastId || null,
        commentCount:   collection.commentCount || 0,
      })

      this._computeRating(collection.ratingSum || 0, collection.ratingCount || 0, collection.ratingDist || {})
      this._computeTagCloud(collection.tagVotes || {})
      this._loadImages(collection.targetId || publicId, 'collection')
    }).catch(() => {
      this.setData({ isLoading: false })
      wx.showToast({ title: '网络异常', icon: 'none' })
    })
  },

  // ── 加载预览（我的未发布合集）────────────────────────────
  _loadPreview(collId) {
    const raw = RDB.getCollById(collId)
    if (!raw) {
      this.setData({ isLoading: false })
      wx.showToast({ title: '找不到合集', icon: 'none' })
      return
    }
    this.setData({ isLoading: false, collection: raw })
    wx.setNavigationBarTitle({ title: (raw.name || '合集详情') + ' · 预览' })
    this._loadImages(collId, 'collection')
  },

  // ── 加载合集图片 ─────────────────────────────────────────
  _loadImages(targetId, targetType) {
    if (!targetId) return
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageList', targetType, targetId },
    }).then(res => {
      const rows = (res.result && res.result.data) || []
      if (!rows.length) return
      const withCached = rows.map(r => ({
        fileID:  r.fileID,
        tempUrl: RDB.getCachedTempUrl(r.fileID) || '',
      }))
      this.setData({ images: withCached })
      const all = withCached.map(r => r.fileID)
      wx.cloud.getTempFileURL({ fileList: all }).then(res2 => {
        const urlMap = {}
        ;(res2.fileList || []).forEach(f => {
          if (f.tempFileURL) { urlMap[f.fileID] = f.tempFileURL; RDB.saveTempUrl(f.fileID, f.tempFileURL) }
        })
        const updated = this.data.images.map(r => urlMap[r.fileID] ? { ...r, tempUrl: urlMap[r.fileID] } : r)
        this.setData({ images: updated })
        this._computeHeroHeight(updated)
      }).catch(() => {})
    }).catch(() => {})
  },

  // ── 根据图片实际比例动态设置 hero 区高度 ────────────────────
  _computeHeroHeight(images) {
    const valid = images.filter(img => img.tempUrl)
    if (!valid.length) return
    let maxRatio = 1   // h/w，默认 1:1
    let pending  = valid.length
    valid.forEach(img => {
      wx.getImageInfo({
        src: img.tempUrl,
        success: (info) => {
          if (info.width > 0) {
            const ratio = info.height / info.width
            if (ratio > maxRatio) maxRatio = ratio
          }
        },
        complete: () => {
          pending--
          if (pending === 0) {
            // 750rpx = 全屏宽；最高 900rpx 避免占屏过多
            const heroHeight = Math.min(Math.round(maxRatio * 750), 900)
            this.setData({ heroHeight })
          }
        },
      })
    })
  },

  // ── 计算评分分布图数据 ───────────────────────────────────
  _computeRating(ratingSum, ratingCount, ratingDist) {
    const avg  = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '0.0'
    const bars = [5, 4, 3, 2, 1].map(star => {
      const cnt = (ratingDist[String(star)] || 0)
      const pct = ratingCount > 0 ? Math.round(cnt / ratingCount * 100) : 0
      return { star, count: cnt, pct }
    })
    this.setData({
      ratingAvg:       avg,
      ratingCount,
      ratingDist,
      ratingBars:      bars,
      showRatingChart: ratingCount >= RATING_CHART_MIN,
    })
  },

  // ── 计算标签云 ───────────────────────────────────────────
  _computeTagCloud(tagVotes) {
    const items = Object.entries(tagVotes || {})
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }))
    const totalVoters = items.reduce((s, i) => s + i.count, 0)
    this.setData({
      tagVotes,
      tagCloudItems:  items,
      showTagCloud:   items.length >= TAG_CLOUD_MIN && totalVoters >= TAG_CLOUD_MIN,
    })
  },

  // ── 图片轮播切换 ─────────────────────────────────────────
  onSwiperChange(e) {
    this.setData({ imageIdx: e.detail.current })
  },

  // ── 点击图片全屏预览（长按可保存/分享）───────────────────
  onPreviewImage(e) {
    const urls = this.data.images.map(img => img.tempUrl).filter(Boolean)
    if (!urls.length) return
    const idx = e.currentTarget.dataset.idx ?? this.data.imageIdx
    wx.previewImage({ urls, current: urls[idx] || urls[0] })
  },

  // ── 展开/收起 配方卡片 ───────────────────────────────────
  onToggleRecipe(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedRecipeId: this.data.expandedRecipeId === id ? '' : id })
  },

  // ── 返回 ────────────────────────────────────────────────
  onBack() { wx.navigateBack() },
  stopProp() {},

  // ── 点赞 ────────────────────────────────────────────────
  onLike() {
    if (this.data.mode === 'preview') return
    const { publicId, isLiked, likeCount } = this.data
    const newLiked = !isLiked
    this.setData({ isLiked: newLiked, likeCount: likeCount + (newLiked ? 1 : -1) })
    wx.cloud.callFunction({ name: 'recipes', data: { action: 'discoverLike', publishId: publicId } })
      .catch(() => {
        this.setData({ isLiked, likeCount })
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
  },

  // ── 收藏（写 shops.favCollIds 或复用 favRecipeIds）────────
  onToggleFav() {
    if (this.data.mode === 'preview') return
    const { publicId, isFav } = this.data
    const newFav = !isFav
    this.setData({ isFav: newFav })
    RDB.toggleFav(publicId)
      .catch(() => {
        this.setData({ isFav })
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
  },

  // ── 复制合集 ────────────────────────────────────────────
  onClone() {
    if (this.data.mode === 'preview') return
    const { publicId } = this.data
    wx.showModal({
      title: '复制合集', content: '将此合集及所有配方复制到「我的」，可自由编辑',
      confirmText: '复制',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '复制中…', mask: true })
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'collClone', publishId: publicId },
        }).then(r2 => {
          wx.hideLoading()
          const rr = r2.result || {}
          if (!rr.success) {
            wx.showToast({ title: rr.error === 'cannot_clone_own' ? '不能复制自己的合集' : '复制失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已复制到我的合集 ✓', icon: 'success' })
          RDB.invalidateCache()
          RDB.preload().catch(() => {})
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '网络异常', icon: 'none' }) })
      },
    })
  },

  // ── 打分 弹窗 ───────────────────────────────────────────
  onShowRatingPicker() {
    if (this.data.mode === 'preview') return
    this.setData({ showRatingInput: true, pendingRating: this.data.myRating })
  },
  onCloseRating() { this.setData({ showRatingInput: false }) },

  onRateStar(e) {
    this.setData({ pendingRating: e.currentTarget.dataset.score })
  },

  onSubmitRating() {
    const { pendingRating, publicId } = this.data
    if (!pendingRating) return
    this.setData({ showRatingInput: false, myRating: pendingRating })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'detailRate', publicId, score: pendingRating },
    }).then(res => {
      const r = res.result || {}
      if (r.success && !r.noChange) {
        this._computeRating(r.ratingSum, r.ratingCount, r.ratingDist)
        wx.showToast({ title: `已打 ${pendingRating} 星 ✓`, icon: 'success' })
      }
    }).catch(() => { wx.showToast({ title: '提交失败，请重试', icon: 'none' }) })
  },

  // ── 贴标签 弹窗 ─────────────────────────────────────────
  onShowTagPicker() {
    if (this.data.mode === 'preview') return
    this.setData({ showTagInput: true, pendingTags: [...this.data.myTags] })
  },
  onCloseTagPicker() { this.setData({ showTagInput: false }) },

  onToggleTagOption(e) {
    const tag  = e.currentTarget.dataset.tag
    const tags = [...this.data.pendingTags]
    const idx  = tags.indexOf(tag)
    if (idx >= 0) {
      tags.splice(idx, 1)
    } else if (tags.length < 5) {
      tags.push(tag)
    } else {
      wx.showToast({ title: '最多选 5 个标签', icon: 'none' }); return
    }
    this.setData({ pendingTags: tags })
  },

  onSubmitTags() {
    const { pendingTags, publicId } = this.data
    this.setData({ showTagInput: false, myTags: pendingTags })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'detailTagVote', publicId, tags: pendingTags },
    }).then(res => {
      const r = res.result || {}
      if (r.success) {
        this._computeTagCloud(r.tagVotes || {})
        wx.showToast({ title: '标签已更新 ✓', icon: 'success' })
      }
    }).catch(() => { wx.showToast({ title: '提交失败', icon: 'none' }) })
  },

  onTagCloudTap(e) {
    if (this.data.mode === 'preview') return
    const tag    = e.currentTarget.dataset.tag
    const myTags = [...this.data.myTags]
    const idx    = myTags.indexOf(tag)
    if (idx >= 0) {
      myTags.splice(idx, 1)
    } else if (myTags.length < 5) {
      myTags.push(tag)
    } else {
      wx.showToast({ title: '最多投 5 个标签', icon: 'none' }); return
    }
    this.setData({ myTags, pendingTags: myTags })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'detailTagVote', publicId: this.data.publicId, tags: myTags },
    }).then(res => {
      const r = res.result || {}
      if (r.success) this._computeTagCloud(r.tagVotes || {})
    }).catch(() => {})
  },

  // ── 评论 ────────────────────────────────────────────────
  onShowCommentInput() {
    if (this.data.mode === 'preview') return
    this.setData({ showCommentInput: true, newComment: '' })
  },
  onCloseCommentInput() { this.setData({ showCommentInput: false }) },
  onCommentInput(e) { this.setData({ newComment: e.detail.value }) },

  onSubmitComment() {
    const { newComment, publicId } = this.data
    if (!(newComment || '').trim()) return
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'detailComment', publicId, content: newComment.trim() },
    }).then(res => {
      const r = res.result || {}
      if (!r.success) { wx.showToast({ title: '发送失败', icon: 'none' }); return }
      this.setData({
        showCommentInput: false,
        newComment: '',
        comments:     [r.comment, ...this.data.comments],
        commentCount: this.data.commentCount + 1,
      })
      wx.showToast({ title: '评论成功 ✓', icon: 'success' })
    }).catch(() => { wx.showToast({ title: '网络异常', icon: 'none' }) })
  },

  onLoadMoreComments() {
    const { commentHasMore, commentLoading, commentLastId, publicId, comments } = this.data
    if (!commentHasMore || commentLoading) return
    this.setData({ commentLoading: true })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'detailCommentList', publicId, lastId: commentLastId, limit: 10 },
    }).then(res => {
      const r = res.result || {}
      this.setData({ commentLoading: false })
      if (!r.success) return
      this.setData({
        comments:       [...comments, ...(r.data || [])],
        commentHasMore: !!r.hasMore,
        commentLastId:  r.lastId || null,
      })
    }).catch(() => this.setData({ commentLoading: false }))
  },
})
