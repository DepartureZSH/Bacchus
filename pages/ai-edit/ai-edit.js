// pages/ai-edit/ai-edit.js
// 营销图编辑页：展示当前图片、管理历史图列表、支持重新生成 & 海报文字编辑
//
// 数据来源：app.globalData.aiEditContext（由 ai-menu 写入后跳转）
//   { mktgMode, mktgType, targetType, targetId, targetName, targetEmoji,
//     selectedData, imgStyle, posterStyle, customPrompt, canvasLayout, currentImg }

const app = getApp()
const RDB = require('../../data/myRecipes')

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

Page({
  data: {
    // ── 上下文（从 globalData 读入）──────────────────────────
    mktgMode:     'recipe',   // 'recipe' | 'collection'
    mktgType:     'cover',    // 'cover' | 'poster' | 'menu'
    targetType:   'recipe',
    targetId:     '',
    targetName:   '',
    targetEmoji:  '🍹',
    selectedData: null,       // 完整配方/合集数据，用于重新生成提示词
    canvasLayout: { shopName:'', headline:'', subline:'', cocktails:[] },

    // ── 当前展示图片 ──────────────────────────────────────────
    // { fileID, tempUrl, localPath, imageId, isCover, style, imageType }
    currentImg: null,

    // ── 历史图片 ─────────────────────────────────────────────
    historyImgs:        [],
    historyLoading:     false,
    historySelectedIdx: -1,   // 当前在大图区显示的历史图序号（-1=刚生成/传入图）

    // ── 风格选择器 ───────────────────────────────────────────
    imgStyles:    IMG_STYLES,
    posterStyles: POSTER_STYLES,
    imgStyle:     'elegant',
    posterStyle:  'luxury',
    customPrompt: '',

    // ── 编辑面板 ─────────────────────────────────────────────
    showEditPanel: false,

    // ── 生成状态 ─────────────────────────────────────────────
    genState: 'idle',   // idle | loading | done | error
    genStep:  '',
    genError: '',
  },

  // ── 内部状态（不走 setData）──────────────────────────────
  _bgTempUrl:   '',    // Canvas 绘制用的背景图 URL
  _canvasTimer: null,

  // ── 生命周期 ─────────────────────────────────────────────
  onLoad() {
    const ctx = app.globalData.aiEditContext || {}

    const currentImg   = ctx.currentImg   || null
    const canvasLayout = ctx.canvasLayout || { shopName:'', headline:'', subline:'', cocktails:[] }

    this.setData({
      mktgMode:     ctx.mktgMode     || 'recipe',
      mktgType:     ctx.mktgType     || 'cover',
      targetType:   ctx.targetType   || 'recipe',
      targetId:     ctx.targetId     || '',
      targetName:   ctx.targetName   || '',
      targetEmoji:  ctx.targetEmoji  || '🍹',
      selectedData: ctx.selectedData || null,
      canvasLayout,
      imgStyle:     ctx.imgStyle     || 'elegant',
      posterStyle:  ctx.posterStyle  || 'luxury',
      customPrompt: ctx.customPrompt || '',
      currentImg,
    })

    if (currentImg && currentImg.tempUrl) {
      this._bgTempUrl = currentImg.tempUrl
    }

    // 加载历史图片
    if (ctx.targetId) {
      this._loadHistory()
    }

    // 传入图片是海报/酒单 → 触发 Canvas 初次绘制
    if (
      currentImg && currentImg.tempUrl &&
      ctx.mktgType !== 'cover' &&
      ctx.mktgMode === 'collection'
    ) {
      setTimeout(() => this._drawCanvas(), 300)
    }
  },

  onUnload() {
    if (this._canvasTimer) { clearTimeout(this._canvasTimer); this._canvasTimer = null }
  },

  // ════════════════════════════════════════════════════════
  // 历史图片
  // ════════════════════════════════════════════════════════

  _loadHistory() {
    const { targetType, targetId } = this.data
    if (!targetId) return

    this.setData({ historyLoading: true })
    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageList', targetType, targetId },
    }).then(res => {
      const rows = (res.result && res.result.data) || []
      if (!rows.length) { this.setData({ historyLoading: false }); return }

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

  // 点击历史缩略图 → 切换大图显示
  onHistoryTap(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img) return

    const isPoster   = img.imageType === 'poster'
    const newMktgType = isPoster ? 'poster' : 'cover'

    this._bgTempUrl = img.tempUrl || ''

    const updates = {
      currentImg: {
        fileID:    img.fileID    || '',
        tempUrl:   img.tempUrl   || '',
        localPath: '',
        imageId:   img._id      || '',
        isCover:   !!img.isCover,
        style:     img.style    || '',
        imageType: img.imageType || 'cover',
      },
      historySelectedIdx: idx,
      mktgType:           newMktgType,
      showEditPanel:      false,
    }

    if (isPoster) {
      if (img.style) updates.posterStyle = img.style
    } else {
      if (img.style) updates.imgStyle = img.style
    }

    this.setData(updates)

    // 海报模式 → 重新绘制 Canvas
    if (newMktgType !== 'cover' && this.data.mktgMode === 'collection') {
      setTimeout(() => this._drawCanvas(), 200)
    }
  },

  // 向历史列表头部插入新生成的图片
  _prependHistory(fileID, tempUrl, style, imageType) {
    const isCover = imageType !== 'poster'
    const updated = isCover
      ? this.data.historyImgs.map(r => ({ ...r, isCover: false }))
      : [...this.data.historyImgs]
    const entry = { _id:'', id:'', fileID, tempUrl, style, imageType, isCover, createdAt: Date.now() }
    this.setData({ historyImgs: [entry, ...updated], historySelectedIdx: -1 })
  },

  // ════════════════════════════════════════════════════════
  // 图片展示 / 预览
  // ════════════════════════════════════════════════════════

  onPreviewImg() {
    const { currentImg } = this.data
    const url = currentImg && (currentImg.localPath || currentImg.tempUrl)
    if (!url) return
    wx.previewImage({ urls: [url], current: url })
  },

  onHistoryImgTap(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img.tempUrl) return
    wx.previewImage({
      urls:    this.data.historyImgs.map(r => r.tempUrl).filter(Boolean),
      current: img.tempUrl,
    })
  },

  // ── 403 过期自动刷新 ─────────────────────────────────────

  onCurrentImgError() {
    const { currentImg } = this.data
    if (!currentImg || !currentImg.fileID) return
    wx.cloud.getTempFileURL({ fileList: [currentImg.fileID] })
      .then(res => {
        const f = res.fileList && res.fileList[0]
        if (!f || !f.tempFileURL) return
        this._bgTempUrl = f.tempFileURL
        RDB.saveTempUrl(currentImg.fileID, f.tempFileURL)
        this.setData({ 'currentImg.tempUrl': f.tempFileURL })
        if (this.data.mktgMode === 'collection' && this.data.mktgType !== 'cover') {
          this._drawCanvas()
        }
      }).catch(() => {})
  },

  onHistoryImgError(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img.fileID) return
    wx.cloud.getTempFileURL({ fileList: [img.fileID] })
      .then(res => {
        const f = res.fileList && res.fileList[0]
        if (!f || !f.tempFileURL) return
        RDB.saveTempUrl(img.fileID, f.tempFileURL)
        this.setData({ [`historyImgs[${idx}].tempUrl`]: f.tempFileURL })
        if (this.data.historySelectedIdx === idx) {
          this._bgTempUrl = f.tempFileURL
          this.setData({ 'currentImg.tempUrl': f.tempFileURL })
        }
      }).catch(() => {})
  },

  // ════════════════════════════════════════════════════════
  // 编辑面板
  // ════════════════════════════════════════════════════════

  onToggleEditPanel() {
    this.setData({ showEditPanel: !this.data.showEditPanel })
  },

  onImgStyleTap(e)    { this.setData({ imgStyle:     e.currentTarget.dataset.id }) },
  onPosterStyleTap(e) { this.setData({ posterStyle:  e.currentTarget.dataset.id }) },
  onCustomPromptInput(e) { this.setData({ customPrompt: e.detail.value }) },

  // 海报文字字段输入 → 防抖重绘 Canvas
  onLayoutInput(e) {
    const { field, idx } = e.currentTarget.dataset
    const val = e.detail.value
    if (idx !== undefined) {
      const cocktails = [...this.data.canvasLayout.cocktails]
      cocktails[idx] = { ...cocktails[idx], [field]: val }
      this.setData({ 'canvasLayout.cocktails': cocktails })
    } else {
      this.setData({ [`canvasLayout.${field}`]: val })
    }
    if (this._canvasTimer) clearTimeout(this._canvasTimer)
    this._canvasTimer = setTimeout(() => this._drawCanvas(), 400)
  },

  // ════════════════════════════════════════════════════════
  // 重新生成
  // ════════════════════════════════════════════════════════

  onRegenerate() {
    const { mktgMode, mktgType, selectedData, imgStyle, posterStyle, customPrompt, targetId, targetType } = this.data
    if (!selectedData) { wx.showToast({ title: '缺少配方数据，请返回重选', icon: 'none' }); return }
    if (this.data.genState === 'loading') return

    this.setData({ genState: 'loading', genStep: '正在生成描述词…', genError: '' })

    if (mktgMode === 'recipe' || (mktgMode === 'collection' && mktgType === 'cover')) {
      // ── 1:1 封面图 ────────────────────────────────────────
      const type = mktgMode === 'recipe' ? 'recipe' : 'collection'
      wx.cloud.callFunction({
        name: 'imagegen',
        data: { action: 'buildPrompt', type, data: selectedData, style: imgStyle, customPrompt },
      }).then(res => {
        const r = res.result || {}
        if (!r.success) { this.setData({ genState: 'error', genError: r.error || '描述词生成失败' }); return }
        this.setData({ genStep: '正在渲染图片…' })

        wx.cloud.callFunction({
          name: 'imagegen',
          data: {
            action: 'genImage', prompt: r.prompt, negPrompt: r.negPrompt || '',
            style: imgStyle, nameHint: (selectedData.name || 'img').slice(0, 12),
            targetType, targetId,
          },
        }).then(res2 => {
          const r2 = res2.result || {}
          if (!r2.success) { this.setData({ genState: 'error', genError: r2.error || '图片生成失败' }); return }

          this._bgTempUrl = r2.tempUrl
          const newImg = {
            fileID: r2.fileID, tempUrl: r2.tempUrl, localPath: '',
            imageId: '', isCover: true, style: imgStyle, imageType: 'cover',
          }
          this.setData({ genState: 'done', currentImg: newImg })
          this._prependHistory(r2.fileID, r2.tempUrl, imgStyle, 'cover')
          if (targetId) RDB.updateCoverTempUrl(targetId, r2.fileID, r2.tempUrl)
        }).catch(() => this.setData({ genState: 'error', genError: '生图请求失败，请检查网络' }))
      }).catch(() => this.setData({ genState: 'error', genError: '描述词生成失败' }))

    } else {
      // ── 3:4 海报/酒单图 ───────────────────────────────────
      wx.cloud.callFunction({
        name: 'imagegen',
        data: { action: 'buildPosterPrompt', data: selectedData, posterStyle, customPrompt },
      }).then(res => {
        const r = res.result || {}
        if (!r.success) { this.setData({ genState: 'error', genError: r.error || '描述生成失败' }); return }
        this.setData({ genStep: '正在渲染背景图…' })

        wx.cloud.callFunction({
          name: 'imagegen',
          data: {
            action: 'genPoster', prompt: r.prompt, negPrompt: r.negPrompt || '',
            size: r.size || '1024x1344', posterStyle,
            targetId, nameHint: (selectedData.name || 'poster').slice(0, 12),
          },
        }).then(res2 => {
          const r2 = res2.result || {}
          if (!r2.success) { this.setData({ genState: 'error', genError: r2.error || '背景图生成失败' }); return }

          this._bgTempUrl = r2.tempUrl
          const newImg = {
            fileID: r2.fileID, tempUrl: r2.tempUrl, localPath: '',
            imageId: '', isCover: false, style: posterStyle, imageType: 'poster',
          }
          this.setData({ genState: 'done', currentImg: newImg })
          this._prependHistory(r2.fileID, r2.tempUrl, posterStyle, 'poster')
          setTimeout(() => this._drawCanvas(), 150)
        }).catch(() => this.setData({ genState: 'error', genError: '背景图生成失败' }))
      }).catch(() => this.setData({ genState: 'error', genError: '描述生成失败' }))
    }
  },

  // ════════════════════════════════════════════════════════
  // Canvas 文字排版（海报/酒单模式）
  // ════════════════════════════════════════════════════════

  _drawCanvas() {
    const { canvasLayout, mktgType } = this.data
    const bgUrl = this._bgTempUrl
    if (!bgUrl) return

    wx.createSelectorQuery()
      .select('#editCanvas')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx    = canvas.getContext('2d')
        const W      = res[0].width
        const H      = res[0].height
        canvas.width  = W
        canvas.height = H

        const img = canvas.createImage()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, W, H)

          // 顶部渐变
          const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.38)
          topGrad.addColorStop(0, 'rgba(0,0,0,0.75)')
          topGrad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, H * 0.38)

          // 底部渐变
          const botGrad = ctx.createLinearGradient(0, H * 0.55, 0, H)
          botGrad.addColorStop(0, 'rgba(0,0,0,0)')
          botGrad.addColorStop(1, 'rgba(0,0,0,0.88)')
          ctx.fillStyle = botGrad; ctx.fillRect(0, H * 0.55, W, H * 0.45)

          const pad = W * 0.08
          ctx.textBaseline = 'top'; ctx.textAlign = 'left'

          // 酒馆名
          ctx.fillStyle = 'rgba(201,169,110,0.95)'
          ctx.font      = `bold ${Math.round(W * 0.042)}px sans-serif`
          ctx.fillText(canvasLayout.shopName || '', pad, H * 0.065)

          // 分隔线
          ctx.strokeStyle = 'rgba(201,169,110,0.45)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(pad, H * 0.125); ctx.lineTo(W - pad, H * 0.125); ctx.stroke()

          ctx.textBaseline = 'bottom'

          // 合集名
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
            cocktails.slice(0, 5).forEach((c, i) => {
              const y = H * 0.855 + i * lineH
              ctx.textAlign = 'left';  ctx.fillText(`• ${c.name}`, pad, y)
              if (c.price) { ctx.textAlign = 'right'; ctx.fillText(`¥${c.price}`, W - pad, y) }
            })
          } else {
            cocktails.slice(0, 4).forEach((c, i) => {
              ctx.textAlign = 'left'
              ctx.fillText(`• ${c.name}`, pad, H * 0.86 + i * lineH)
            })
          }

          // 导出临时文件
          const tmpPath = `${wx.env.USER_DATA_PATH}/edit_${Date.now()}.jpg`
          canvas.toDataURL('image/jpeg', 0.92, (dataUrl) => {
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
            wx.getFileSystemManager().writeFile({
              filePath: tmpPath, data: base64, encoding: 'base64',
              success: () => this.setData({ 'currentImg.localPath': tmpPath }),
              fail: () => {},
            })
          })
        }
        img.onerror = () => {}
        img.src = bgUrl
      })
  },

  // ════════════════════════════════════════════════════════
  // 操作按钮：保存 / 分享 / 设封面
  // ════════════════════════════════════════════════════════

  onSaveImg() {
    const { currentImg } = this.data
    const path = currentImg && (currentImg.localPath || currentImg.tempUrl)
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

  onShareImg() {
    const { currentImg } = this.data
    const path = currentImg && (currentImg.localPath || currentImg.tempUrl)
    if (!path) { wx.showToast({ title: '图片未就绪', icon: 'none' }); return }
    wx.showShareImageMenu({ path })
      .catch(() => wx.showToast({ title: '长按图片可转发', icon: 'none', duration: 2500 }))
  },

  // 当前大图设为封面
  onSetCover() {
    const { currentImg, targetId, targetType } = this.data
    if (!currentImg) return
    const imageId = currentImg.imageId || ''
    if (!imageId) { wx.showToast({ title: '图片尚未入库，请稍后重试', icon: 'none' }); return }

    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageSetCover', imageId, targetId, targetType },
    }).then(res => {
      if (!res.result || !res.result.success) { wx.showToast({ title: '操作失败', icon: 'none' }); return }
      const updated = this.data.historyImgs.map(r => ({ ...r, isCover: r._id === imageId }))
      this.setData({ historyImgs: updated, 'currentImg.isCover': true })
      RDB.updateCoverTempUrl(targetId, currentImg.fileID, currentImg.tempUrl || '')
      wx.showToast({ title: '已设为封面 ✓', icon: 'success' })
    }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  // 历史图片行内：设为封面
  onHistorySetCover(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img._id) return
    const { targetId, targetType } = this.data

    wx.cloud.callFunction({
      name: 'recipes',
      data: { action: 'imageSetCover', imageId: img._id, targetId, targetType },
    }).then(res => {
      if (!res.result || !res.result.success) { wx.showToast({ title: '操作失败', icon: 'none' }); return }
      const updated = this.data.historyImgs.map((r, i) => ({ ...r, isCover: i === idx }))
      this.setData({ historyImgs: updated })
      RDB.updateCoverTempUrl(targetId, img.fileID, img.tempUrl || '')
      wx.showToast({ title: '已设为封面 ✓', icon: 'success' })
    }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },

  // 历史图片行内：保存到相册
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

  // 历史图片行内：删除
  onHistoryDeleteImg(e) {
    const { idx } = e.currentTarget.dataset
    const img = this.data.historyImgs[idx]
    if (!img || !img._id) { wx.showToast({ title: '无法删除未保存的图片', icon: 'none' }); return }

    wx.showModal({
      title: '删除图片', content: '删除后不可恢复',
      confirmText: '删除', confirmColor: '#e05c5c',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'recipes',
          data: { action: 'imageDelete', imageId: img._id, targetId: this.data.targetId },
        }).then(res2 => {
          const r = res2.result || {}
          if (!r.success) { wx.showToast({ title: '删除失败', icon: 'none' }); return }

          const remaining = this.data.historyImgs.filter((_, i) => i !== idx)
          this.setData({ historyImgs: remaining })

          if (r.wascover && remaining.length > 0 && remaining[0].tempUrl) {
            RDB.updateCoverTempUrl(this.data.targetId, remaining[0].fileID, remaining[0].tempUrl)
          }

          // 如果删的是当前大图 → 切换到下一张
          const selIdx = this.data.historySelectedIdx
          if (selIdx === idx) {
            if (remaining.length > 0) {
              const first = remaining[0]
              this._bgTempUrl = first.tempUrl || ''
              this.setData({
                currentImg: {
                  fileID: first.fileID, tempUrl: first.tempUrl || '', localPath: '',
                  imageId: first._id || '', isCover: !!first.isCover,
                  style: first.style || '', imageType: first.imageType || 'cover',
                },
                historySelectedIdx: 0,
              })
            } else {
              this.setData({ currentImg: null, historySelectedIdx: -1 })
            }
          }
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(() => wx.showToast({ title: '删除失败', icon: 'none' }))
      },
    })
  },
})
