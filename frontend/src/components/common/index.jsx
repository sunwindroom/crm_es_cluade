import { useState, useEffect } from 'react'
import { fmt } from '../../hooks'

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, width = 'max-w-2xl' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${width} animate-scale-in`}>
        <div className="modal-header">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="btn-icon text-lg leading-none">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title = '确认操作', message, loading }) {
  if (!open) return null
  return (
    <div className="modal-overlay">
      <div className="modal max-w-sm animate-scale-in">
        <div className="modal-header">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="text-sm text-gray-600">{message || '确定要执行此操作吗？'}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? '处理中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <span className="text-sm text-gray-500">共 <strong>{total}</strong> 条，第 {page}/{totalPages} 页</span>
      <div className="pagination">
        <button className={`page-btn-inactive ${page === 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
          onClick={() => page > 1 && onChange(page - 1)} disabled={page === 1}>‹</button>
        {start > 1 && <><button className="page-btn-inactive" onClick={() => onChange(1)}>1</button>{start > 2 && <span className="px-1 text-gray-400">…</span>}</>}
        {pages.map(p => (
          <button key={p} className={p === page ? 'page-btn-active' : 'page-btn-inactive'} onClick={() => onChange(p)}>{p}</button>
        ))}
        {end < totalPages && <>{end < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}<button className="page-btn-inactive" onClick={() => onChange(totalPages)}>{totalPages}</button></>}
        <button className={`page-btn-inactive ${page === totalPages ? 'opacity-40 cursor-not-allowed' : ''}`}
          onClick={() => page < totalPages && onChange(page + 1)} disabled={page === totalPages}>›</button>
      </div>
    </div>
  )
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return (
    <div className={`${s} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <span className="text-sm text-gray-400">加载中...</span>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📭', title = '暂无数据', desc, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="font-medium text-gray-600 mb-1">{title}</div>
      {desc && <div className="empty-text">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = '搜索...', onSearch }) {
  return (
    <div className="search-bar">
      <span className="text-gray-400">🔍</span>
      <input
        className="search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => e.key === 'Enter' && onSearch?.()}
      />
      {value && <button onClick={() => onChange('')} className="text-gray-400 hover:text-gray-600">×</button>}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ icon, iconBg, title, value, sub, trend }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-1">{title}</div>
        <div className="text-2xl font-bold text-gray-800 leading-none">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, color = 'bg-blue-500', showLabel = true }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar flex-1">
        <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>}
    </div>
  )
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export function FormField({ label, required, error, children, hint }) {
  return (
    <div className="form-group">
      {label && (
        <label className={`form-label ${required ? 'form-label-required' : ''}`}>{label}</label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

// ─── Table ─────────────────────────────────────────────────────────────────
export function Table({ columns, data, loading, rowKey = 'id', onRowClick }) {
  if (loading) {
    return (
      <div className="table-wrapper">
        <table className="table">
          <thead><tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr></thead>
          <tbody>
            {[1,2,3,4,5].map(i => (
              <tr key={i}>
                {columns.map(c => <td key={c.key}><div className="skeleton h-4 rounded w-3/4" /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (!data?.length) return <EmptyState />
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>{columns.map(c => <th key={c.key} style={c.width ? {width:c.width} : {}}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row[rowKey]} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer' : ''}>
              {columns.map(c => (
                <td key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs({ items, active, onChange }) {
  return (
    <div className="tab-nav">
      {items.map(item => (
        <button
          key={item.key}
          className={active === item.key ? 'tab-item-active' : 'tab-item-inactive'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${active === item.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function PageHeader({ title, desc, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
