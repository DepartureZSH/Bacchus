// pages/admin-import/admin-import.js
// 管理员批量导入配方页面
// 进入后自动触发文件选择 → 解析展示 → 勾选 → 确认导入

Page({
  data: {
    fileName:      '',
    recipes:       [],   // 解析后预处理的配方列表
    selected:      {},   // { index: bool }
    selectAll:     true,
    selectedCount: 0,
    totalCount:    0,
    parsing:       false,
    importing:     false,
  },

  onLoad() {
    // 进入页面自动弹出文件选择
    this.onSelectFile()
  },

  // ── 选择文件 ──────────────────────────────────────────────
  onSelectFile() {
    wx.chooseMessageFile({
      count: 1,
      type:  'file',
      success: (res) => {
        const file = res.tempFiles[0]
        if (!file) return
        this.setData({ parsing: true, recipes: [], selected: {}, selectedCount: 0, totalCount: 0, fileName: '' })
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (r) => this._parseAndSet(r.data, file.name || '未知文件'),
          fail: () => {
            this.setData({ parsing: false })
            wx.showToast({ title: '读取文件失败', icon: 'none' })
          },
        })
      },
    })
  },

  // ── 解析文件内容，构建展示数据 ──────────────────────────────
  _parseAndSet(text, fileName) {
    const rawList  = []
    const errLines = []
    const t        = (text || '').trim()

    if (t.startsWith('[')) {
      // JSON 数组格式
      try {
        const arr = JSON.parse(t)
        if (Array.isArray(arr)) rawList.push(...arr)
      } catch (_) {
        this.setData({ parsing: false })
        wx.showToast({ title: '文件格式错误', icon: 'none' })
        return
      }
    } else {
      // JSONL 格式：每行一个 JSON 对象
      t.split('\n').forEach((line, i) => {
        const l = line.trim()
        if (!l) return
        try { rawList.push(JSON.parse(l)) }
        catch (_) { errLines.push(i + 1) }
      })
    }

    if (!rawList.length) {
      this.setData({ parsing: false })
      wx.showToast({ title: '未解析到配方', icon: 'none' })
      return
    }

    // 预处理：补充展示用字段
    const recipes = rawList.map((r, index) => ({
      ...r,
      _idx:              index,
      emoji:             r.emoji || '🍹',
      ingredientPreview: (r.ingredients || []).slice(0, 3),
      moreCount:         Math.max(0, (r.ingredients || []).length - 3),
    }))

    // 全部默认选中
    const selected = {}
    recipes.forEach((_, i) => { selected[i] = true })

    this.setData({
      fileName,
      recipes,
      selected,
      selectAll:     true,
      selectedCount: recipes.length,
      totalCount:    recipes.length,
      parsing:       false,
    })

    if (errLines.length) {
      wx.showToast({ title: `${errLines.length} 行解析失败已跳过`, icon: 'none', duration: 2500 })
    }
  },

  // ── 全选 / 全不选 ──────────────────────────────────────────
  onToggleAll() {
    const newVal   = !this.data.selectAll
    const selected = {}
    this.data.recipes.forEach((_, i) => { selected[i] = newVal })
    this.setData({
      selectAll:     newVal,
      selected,
      selectedCount: newVal ? this.data.totalCount : 0,
    })
  },

  // ── 单条选择切换 ───────────────────────────────────────────
  onToggleItem(e) {
    const idx      = +e.currentTarget.dataset.index
    const selected = { ...this.data.selected }
    selected[idx]  = !selected[idx]
    const selectedCount = Object.values(selected).filter(Boolean).length
    this.setData({
      selected,
      selectedCount,
      selectAll: selectedCount === this.data.totalCount,
    })
  },

  // ── 确认导入 ──────────────────────────────────────────────
  onImport() {
    if (this.data.importing || this.data.selectedCount === 0) return
    const toImport = this.data.recipes.filter((_, i) => this.data.selected[i])

    wx.showModal({
      title:       '确认导入',
      content:     `将导入 ${toImport.length} 条配方，已存在同名配方将自动跳过。`,
      confirmText: '导入',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ importing: true })
        wx.showLoading({ title: '导入中…', mask: true })

        // 去掉前端额外字段，只传配方原始数据
        const payload = toImport.map(({ _idx, ingredientPreview, moreCount, ...r }) => r)

        wx.cloud.callFunction({
          name:    'recipes',
          data:    { action: 'adminBulkImport', recipes: payload },
          timeout: 120000,
        }).then(res2 => {
          wx.hideLoading()
          this.setData({ importing: false })
          const result = res2.result || {}
          if (result.success) {
            const errTip = result.errors && result.errors.length
              ? `\n${result.errors.length} 条写入失败`
              : ''
            wx.showModal({
              title:      '导入完成',
              content:    `成功导入 ${result.count} 条\n其中同步到发现页 ${result.pubCount} 条\n跳过已有 ${result.skipped} 条${errTip}`,
              showCancel: false,
              success:    () => wx.navigateBack(),
            })
          } else {
            wx.showToast({ title: result.error || '导入失败', icon: 'none' })
          }
        }).catch(() => {
          wx.hideLoading()
          this.setData({ importing: false })
          wx.showToast({ title: '网络错误，请重试', icon: 'none' })
        })
      },
    })
  },

  stopProp() {},
})
