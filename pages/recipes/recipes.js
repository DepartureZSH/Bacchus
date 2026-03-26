// pages/recipes/recipes.js
const { RECIPES } = require('../../data/recipes')

const ALL_BASES  = ['全部', '金酒', '伏特加', '朗姆酒', '龙舌兰', '威士忌', '无酒精', '其他']
const ALL_STYLES = ['全部', '经典', '果味', '清爽', '创意', '热饮', '咸鲜']

Page({
  data: {
    bases:        ALL_BASES,
    styles:       ALL_STYLES,
    currentBase:  '全部',
    currentStyle: '全部',
    searchText:   '',
    filtered:     [],
    expandedId:   null,
  },

  onLoad() { this._filter() },

  onSearch(e) {
    this.setData({ searchText: e.detail.value }, () => this._filter())
  },

  onFilterBase(e) {
    this.setData({ currentBase: e.currentTarget.dataset.val, expandedId: null }, () => this._filter())
  },

  onFilterStyle(e) {
    this.setData({ currentStyle: e.currentTarget.dataset.val, expandedId: null }, () => this._filter())
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? null : id })
  },

  _filter() {
    const { currentBase, currentStyle, searchText } = this.data
    let list = RECIPES

    if (currentBase !== '全部') {
      if (currentBase === '其他') {
        const known = ALL_BASES.filter(b => b !== '全部' && b !== '其他')
        list = list.filter(r => !known.includes(r.base))
      } else {
        list = list.filter(r => r.base === currentBase)
      }
    }

    if (currentStyle !== '全部') {
      list = list.filter(r => r.style === currentStyle)
    }

    if (searchText.trim()) {
      const q = searchText.trim()
      list = list.filter(r =>
        r.name.includes(q) || r.base.includes(q) ||
        r.desc.includes(q) || r.ingredients.some(i => i.name.includes(q))
      )
    }

    // 加工原料预览字段
    list = list.map(r => ({
      ...r,
      ingredientPreview: r.ingredients.slice(0, 3),
      moreCount: Math.max(0, r.ingredients.length - 3),
    }))

    this.setData({ filtered: list })
  },
})
