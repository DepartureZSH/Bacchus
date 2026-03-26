// pages/export/export.js
const app = getApp()
const DB  = require('../../data/ingredients')

function nowStr() {
  const d = new Date()
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const COL_WEIGHTS = {
  inventory: [3,3,2,2,1,2,2,2,2],
  alerts:    [3,2,2,1,2,2,2],
  logs:      [2,2,2,2,1,2,3,2],
  purchase:  [3,3,2,2,1,2,2,2],
}

function buildInventory(list) {
  const rows = list.map(i => [i.name, i.brand||'', i.cat, String(i.stock), i.unit, String(i.threshold), String(i.costPerUnit), i.status==='danger'?'告急':i.status==='warn'?'偏低':'正常', '¥'+(i.stock*i.costPerUnit).toFixed(0)])
  return { title:'库存清单', headers:['名称','品牌','品类','库存','单位','阈值','单价','状态','价值'], weights:COL_WEIGHTS.inventory, rows, count:rows.length }
}
function buildAlerts(list) {
  const rows = list.filter(i=>i.status!=='ok').map(i => [i.name, i.cat, String(i.stock), i.unit, String(i.threshold), i.status==='danger'?'🔴告急':'🟡偏低', String(Math.max(0,i.threshold*2-i.stock))])
  return { title:'低库存预警', headers:['名称','品类','当前库存','单位','阈值','状态','建议采购'], weights:COL_WEIGHTS.alerts, rows, count:rows.length }
}
function buildPurchase(list) {
  const rows = list.filter(i=>i.status!=='ok').map(i => {
    const qty = Math.max(0,i.threshold*2-i.stock)
    return [i.name, i.brand||'', i.cat, String(qty), i.unit, '¥'+i.costPerUnit, '¥'+(qty*i.costPerUnit).toFixed(0), i.status==='danger'?'⚡紧急':'普通']
  })
  return { title:'采购建议', headers:['名称','品牌','品类','采购量','单位','单价','预估','优先级'], weights:COL_WEIGHTS.purchase, rows, count:rows.length }
}

function toCSV(data) {
  return data.headers.join(',') + '\n' + data.rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
}
function toMarkdown(data) {
  return `**${data.title}** (${data.count} 条)\n\n|${data.headers.join('|')}|\n|${data.headers.map(()=>'---').join('|')}|\n${data.rows.map(r=>'|'+r.join('|')+'|').join('\n')}`
}
function toText(data) {
  const shop = app.globalData.shopInfo.name || 'Bacchus'
  let out = `【${shop}】${data.title}\n导出时间：${nowStr()}\n${'─'.repeat(24)}\n`
  data.rows.forEach((row,i) => { out += `${i+1}. ${row.join('  ')}\n` })
  return out + `${'─'.repeat(24)}\n共 ${data.count} 条`
}

Page({
  data: {
    isPro: false, currentType: 'inventory',
    exportTypes: [
      { id:'inventory', icon:'📦', name:'库存清单',   desc:'全部原料的当前库存状态' },
      { id:'alerts',    icon:'⚠️', name:'低库存预警', desc:'需要补货的原料及建议采购量' },
      { id:'logs',      icon:'📋', name:'操作记录',   desc:'所有入库/出库操作历史' },
      { id:'purchase',  icon:'🛒', name:'采购建议',   desc:'含优先级和预估总金额' },
    ],
    previewTitle:'', previewCols:[], previewRows:[], previewTotal:0,
    exportHistory:[], loading:false,
  },

  onLoad()  { this._refresh('inventory') },
  onShow()  {
    this.setData({ isPro: app.globalData.shopInfo.plan === 'pro' || app.globalData.shopInfo.plan === 'Pro' })
  },

  onSelectType(e) { this._refresh(e.currentTarget.dataset.id) },

  _refresh(typeId) {
    this.setData({ loading: true })
    // logs 类型需要单独获取每条原料的日志，其余只需列表
    DB.getAll().then(list => {
      if (typeId === 'logs') {
        return this._buildLogs(list)
      }
      const builders = { inventory: buildInventory, alerts: buildAlerts, purchase: buildPurchase }
      const data = builders[typeId](list)
      this._applyPreview(typeId, data)
    }).catch(() => this.setData({ loading: false }))
  },

  _buildLogs(list) {
    // 为每条原料拉取日志（仅拉前20条）
    const promises = list.slice(0, 30).map(ing =>
      DB.getLogs(ing._id || ing.id, 0, 20).then(logs => ({ ing, logs }))
    )
    Promise.all(promises).then(results => {
      const rows = []
      results.forEach(({ ing, logs }) => {
        logs.forEach(log => {
          rows.push([ing.name, ing.cat, log.delta>0?'入库':'出库', (log.delta>0?'+':'')+String(log.delta), ing.unit, log.reason||'', log.createdAtStr||'', String(log.balance)])
        })
      })
      const data = { title:'操作记录', headers:['原料','品类','操作','变化','单位','原因','时间','余量'], weights:COL_WEIGHTS.logs, rows, count:rows.length }
      this._applyPreview('logs', data)
    }).catch(() => this.setData({ loading: false }))
  },

  _applyPreview(typeId, data) {
    const weights = data.weights
    const total   = weights.reduce((s,w)=>s+w, 0)
    const previewCols = data.headers.map((label,i) => ({ label, pct: Math.round(weights[i]/total*100) }))
    const previewRows = data.rows.slice(0,5).map(row =>
      row.map((text,ci) => ({ text, pct: Math.round(weights[ci]/total*100), right: /^[-+¥\d]/.test(text) }))
    )
    this.setData({ currentType:typeId, previewTitle:data.title, previewCols, previewRows, previewTotal:data.count, loading:false })
    this._currentData = data
  },

  _getData() { return this._currentData },
  _addHistory(format) {
    const name = this._getData() ? this._getData().title : ''
    this.setData({ exportHistory: [{ icon:'📤', name, format, time:nowStr() }, ...this.data.exportHistory.slice(0,4)] })
  },

  onCopyCSV()      { wx.setClipboardData({ data:toCSV(this._getData()),      success:()=>{ wx.showToast({title:'CSV 已复制',icon:'success'}); this._addHistory('CSV') } }) },
  onCopyMarkdown() { wx.setClipboardData({ data:toMarkdown(this._getData()), success:()=>{ wx.showToast({title:'Markdown 已复制',icon:'success'}); this._addHistory('Markdown') } }) },
  onCopyText()     { wx.setClipboardData({ data:toText(this._getData()),     success:()=>{ wx.showToast({title:'文本已复制',icon:'success'}); this._addHistory('纯文本') } }) },

  onExportImage() {
    if (!this.data.isPro) {
      wx.showModal({ title:'升级 Pro 解锁', content:'生成图片导出功能仅限 Pro 版用户', confirmText:'去升级',
        success:(res)=>{ if(res.confirm) wx.navigateTo({url:'/pages/subscription/subscription'}) } })
      return
    }
    wx.showToast({ title:'图片生成功能开发中 🖼', icon:'none', duration:2000 })
  },
})
