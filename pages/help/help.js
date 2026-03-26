// pages/help/help.js
Page({
  data: {
    expandedFaq:   null,
    feedbackType:  '功能建议',
    feedbackText:  '',
    feedbackTypes: ['功能建议', 'Bug反馈', '内容问题', '其他'],
    faqs: [
      {
        id: 1,
        q: '扫码录入时查不到商品信息怎么办？',
        a: '部分进口酒或小众品牌数据库暂无收录。可手动填写原料信息，或在条形码字段手动输入条码以便将来匹配。我们会持续扩充数据库覆盖范围。'
      },
      {
        id: 2,
        q: 'AI 酒单生成次数用完了怎么办？',
        a: '免费版每月可生成 10 次 AI 酒单，Pro 版无限制。次数在每月 1 日自动重置。升级 Pro 版可在「我的 → 订阅状态」中操作。'
      },
      {
        id: 3,
        q: '库存数据会丢失吗？',
        a: '所有数据存储在您的手机本地（wx.storage），正常使用不会丢失。换设备或清除微信缓存会导致数据丢失，云端同步功能正在开发中，Pro 版将优先支持。'
      },
      {
        id: 4,
        q: '如何批量导入原料数据？',
        a: '目前支持手动逐条录入和扫码录入。批量 CSV 导入功能正在开发，预计下个版本上线。如有大量数据需要迁移，可联系客服协助处理。'
      },
      {
        id: 5,
        q: '单位从 ml 改为 oz 后，已有数据怎么处理？',
        a: '单位设置仅影响新录入的原料和显示偏好，已有数据不会自动换算（以避免误差）。建议在初次使用时确定好单位。如需换算，可在原料详情页手动修改数值。'
      },
      {
        id: 6,
        q: 'AI 酒单推荐的酒品可以手动调整吗？',
        a: '可以。AI 酒单页面生成结果后，您可以展开每款酒查看详细配方和原料，后续版本将支持直接编辑 AI 推荐的配方并保存为自定义酒单。'
      },
      {
        id: 7,
        q: '采购清单如何导出分享给供应商？',
        a: '在采购清单页点击「复制清单」，可将完整清单文本复制到剪贴板，然后粘贴到微信、短信或邮件发送。后续版本将支持一键生成图片分享。'
      },
    ],
  },

  onFaqTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedFaq: this.data.expandedFaq === id ? null : id })
  },

  onSelectType(e) {
    this.setData({ feedbackType: e.currentTarget.dataset.val })
  },

  onFeedbackInput(e) {
    this.setData({ feedbackText: e.detail.value })
  },

  onSubmitFeedback() {
    if (!this.data.feedbackText.trim()) return
    wx.showLoading({ title: '提交中…' })
    setTimeout(() => {
      wx.hideLoading()
      this.setData({ feedbackText: '' })
      wx.showToast({ title: '感谢反馈！我们会认真阅读 🙏', icon: 'none', duration: 2500 })
    }, 800)
  },

  onFeedback() {
    wx.showToast({ title: '请使用下方反馈表单 👇', icon: 'none' })
  },

  onWechat() {
    wx.showToast({ title: '客服微信：bacchus_support（即将开放）', icon: 'none', duration: 2500 })
  },

  onCommunity() {
    wx.showToast({ title: '用户社区建设中，敬请期待 🌐', icon: 'none', duration: 2000 })
  },

  onPrivacy() {
    wx.showToast({ title: '隐私政策页面即将上线', icon: 'none' })
  },

  onTerms() {
    wx.showToast({ title: '用户协议页面即将上线', icon: 'none' })
  },
})
