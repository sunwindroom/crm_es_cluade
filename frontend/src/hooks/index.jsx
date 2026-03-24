import { useState, useCallback } from 'react'
import { useNotifyStore } from '../store'

export function useAsync(asyncFn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const notify = useNotifyStore(s => s.notify)

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn(...args)
      return result
    } catch (err) {
      const msg = err?.message || '操作失败'
      setError(msg)
      notify('error', msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [asyncFn])

  return { loading, error, run }
}

export function usePagination(defaultPageSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(defaultPageSize)
  const [total, setTotal] = useState(0)
  const totalPages = Math.ceil(total / pageSize)

  const reset = () => setPage(1)

  return { page, setPage, pageSize, total, setTotal, totalPages, reset }
}

// Format helpers
export const fmt = {
  money: (v, decimals = 2) => {
    if (v == null || v === '') return '—'
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)
  },
  yuan: (v) => v == null ? '—' : `¥${fmt.money(v)}`,
  wan: (v) => {
    if (v == null) return '—'
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}亿`
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`
    return fmt.money(v, 0)
  },
  date: (v) => v ? v.slice(0, 10) : '—',
  datetime: (v) => v ? v.slice(0, 16).replace('T', ' ') : '—',
  percent: (v) => v == null ? '—' : `${v}%`,
}

export const STATUS_LABELS = {
  // Lead status
  new: { label: '新线索', cls: 'badge-blue' },
  contacted: { label: '已联系', cls: 'badge-yellow' },
  qualified: { label: '已确认', cls: 'badge-purple' },
  converted: { label: '已转化', cls: 'badge-green' },
  lost: { label: '已失效', cls: 'badge-gray' },
  // Customer status
  active: { label: '正常', cls: 'badge-green' },
  inactive: { label: '非活跃', cls: 'badge-gray' },
  blacklist: { label: '黑名单', cls: 'badge-red' },
  // Opportunity stage
  prospecting: { label: '意向挖掘', cls: 'badge-blue' },
  qualification: { label: '需求确认', cls: 'badge-purple' },
  proposal: { label: '方案报价', cls: 'badge-yellow' },
  negotiation: { label: '商务谈判', cls: 'badge-orange' },
  closed_won: { label: '赢单', cls: 'badge-green' },
  closed_lost: { label: '输单', cls: 'badge-red' },
  // Project status
  planning: { label: '规划中', cls: 'badge-blue' },
  in_progress: { label: '进行中', cls: 'badge-purple' },
  completed: { label: '已完成', cls: 'badge-green' },
  suspended: { label: '已暂停', cls: 'badge-yellow' },
  cancelled: { label: '已取消', cls: 'badge-gray' },
  // Contract status
  draft: { label: '草稿', cls: 'badge-gray' },
  review: { label: '审批中', cls: 'badge-yellow' },
  signed: { label: '已签署', cls: 'badge-green' },
  rejected: { label: '已驳回', cls: 'badge-red' },
  expired: { label: '已到期', cls: 'badge-orange' },
  // Payment status
  pending: { label: '待确认', cls: 'badge-yellow' },
  confirmed: { label: '已确认', cls: 'badge-green' },
  failed: { label: '失败', cls: 'badge-red' },
  // Task status
  todo: { label: '待处理', cls: 'badge-gray' },
  // Customer level
  normal: { label: '普通', cls: 'badge-gray' },
  important: { label: '重要', cls: 'badge-blue' },
  vip: { label: 'VIP', cls: 'badge-purple' },
  // Priority
  low: { label: '低', cls: 'badge-gray' },
  high: { label: '高', cls: 'badge-orange' },
  urgent: { label: '紧急', cls: 'badge-red' },
}

export function Badge({ status }) {
  const cfg = STATUS_LABELS[status] || { label: status, cls: 'badge-gray' }
  return <span className={cfg.cls}>{cfg.label}</span>
}

export const LEAD_SOURCES = ['官网', '展会', '推荐', '电话', '广告', '社交媒体', '合作伙伴', '其他']
export const INDUSTRIES = ['互联网', '金融', '制造业', '零售', '医疗', '教育', '贸易', '房地产', '能源', '软件', '其他']
export const REGIONS = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆', '其他']
export const PAYMENT_METHODS = [
  { value: 'transfer', label: '银行转账' },
  { value: 'check', label: '支票' },
  { value: 'cash', label: '现金' },
  { value: 'online', label: '网络支付' },
]
