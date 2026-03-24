import { useState, useEffect, useCallback } from 'react'
import { paymentsAPI, contractsAPI, customersAPI } from '../api'
import { useNotifyStore } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, StatCard } from '../components/common'
import { Badge, fmt, PAYMENT_METHODS } from '../hooks'

const INIT_FORM = { contract_id: '', contract_name: '', customer_id: '', customer_name: '', amount: '', payment_date: '', payment_method: 'transfer', bank_account: '', remark: '' }

export default function Payments() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', status: '', payment_method: '', start_date: '', end_date: '' })
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [form, setForm] = useState(INIT_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null })
  const [contracts, setContracts] = useState([])
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState({ confirmed: 0, pending: 0 })
  const notify = useNotifyStore(s => s.notify)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await paymentsAPI.list({ page, pageSize: PAGE_SIZE, ...filters })
      setList(res.data.list); setTotal(res.data.total)
      setStats(res.data.stats || { confirmed: 0, pending: 0 })
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    contractsAPI.list({ pageSize: 200, status: 'signed' }).then(r => setContracts(r.data.list))
    customersAPI.list({ pageSize: 200 }).then(r => setCustomers(r.data.list))
  }, [])

  const openCreate = () => { setForm({ ...INIT_FORM, payment_date: new Date().toISOString().split('T')[0] }); setModal({ open: true, mode: 'create', data: null }) }
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: 'edit', data: row }) }

  const handleSave = async () => {
    if (!form.amount || !form.payment_date) return notify('error', '回款金额和日期必填')
    setSaving(true)
    try {
      if (modal.mode === 'create') { await paymentsAPI.create(form); notify('success', '回款记录创建成功') }
      else { await paymentsAPI.update(modal.data.id, form); notify('success', '回款记录更新成功') }
      setModal({ ...modal, open: false }); load()
    } catch (e) { notify('error', e?.message || '操作失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await paymentsAPI.remove(delConfirm.id); notify('success', '删除成功'); setDelConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '删除失败') }
  }

  const handleConfirm = async () => {
    try { await paymentsAPI.confirm(confirmDialog.id); notify('success', '回款确认成功'); setConfirmDialog({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '确认失败') }
  }

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleContractChange = (cid) => {
    const c = contracts.find(x => x.id == cid)
    setForm(f => ({ ...f, contract_id: cid, contract_name: c?.name || '', customer_id: c?.customer_id || '', customer_name: c?.customer_name || '' }))
  }

  const columns = [
    { key: 'payment_no', title: '回款单号', render: v => <span className="font-mono text-xs text-gray-600">{v}</span> },
    { key: 'customer_name', title: '客户' },
    { key: 'contract_name', title: '合同', render: v => <span className="text-gray-600 text-xs">{v || '—'}</span> },
    { key: 'amount', title: '回款金额', render: v => <span className="font-bold text-lg text-gray-800">{fmt.yuan(v)}</span>, align: 'right' },
    { key: 'payment_date', title: '回款日期', render: v => fmt.date(v) },
    { key: 'payment_method', title: '收款方式', render: v => PAYMENT_METHODS.find(m => m.value === v)?.label || v },
    { key: 'status', title: '状态', render: v => <Badge status={v} /> },
    { key: 'creator_name', title: '录入人' },
    {
      key: 'actions', title: '操作', width: '160px',
      render: (_, r) => (
        <div className="flex items-center gap-1">
          {r.status === 'pending' && (
            <button className="btn btn-sm text-emerald-600 hover:bg-emerald-50 border-0 shadow-none" onClick={() => setConfirmDialog({ open: true, id: r.id })}>确认</button>
          )}
          <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={() => openEdit(r)}>编辑</button>
          <button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={() => setDelConfirm({ open: true, id: r.id })}>删除</button>
        </div>
      )
    },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="回款管理" desc="管理合同回款，跟踪收款进度，进行财务确认"
        actions={<button className="btn-primary" onClick={openCreate}>＋ 登记回款</button>} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon="💰" iconBg="bg-emerald-50" title="已确认回款" value={fmt.wan(stats.confirmed)} sub="累计已确认金额" />
        <StatCard icon="⏳" iconBg="bg-amber-50" title="待确认回款" value={fmt.wan(stats.pending)} sub="等待财务确认" />
        <StatCard icon="📋" iconBg="bg-blue-50" title="本次查询记录" value={`${total}条`} sub="符合筛选条件" />
        <StatCard icon="✅" iconBg="bg-purple-50" title="确认率"
          value={total > 0 ? `${Math.round(list.filter(p => p.status === 'confirmed').length / Math.min(list.length, 1) * 100)}%` : '—'}
          sub="当页已确认比例" />
      </div>

      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v => setFilter('keyword', v)} placeholder="搜索单号、客户、合同名称..." onSearch={load} />
        <select className="form-select w-28" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待确认</option>
          <option value="confirmed">已确认</option>
        </select>
        <select className="form-select w-28" value={filters.payment_method} onChange={e => setFilter('payment_method', e.target.value)}>
          <option value="">全部方式</option>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input type="date" className="form-input w-36" value={filters.start_date} onChange={e => setFilter('start_date', e.target.value)} />
        <span className="text-gray-400 text-sm">至</span>
        <input type="date" className="form-input w-36" value={filters.end_date} onChange={e => setFilter('end_date', e.target.value)} />
        <button className="btn-secondary btn-sm ml-auto" onClick={() => { setFilters({ keyword: '', status: '', payment_method: '', start_date: '', end_date: '' }); setPage(1) }}>重置</button>
      </div>

      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} /></div>
      </div>

      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.mode === 'create' ? '登记回款' : '编辑回款'} width="max-w-2xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="关联合同">
            <select className="form-select" value={form.contract_id || ''} onChange={e => handleContractChange(e.target.value)}>
              <option value="">不关联合同</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="关联客户">
            <select className="form-select" value={form.customer_id || ''} onChange={e => { const c = customers.find(x => x.id == e.target.value); setForm(f => ({ ...f, customer_id: e.target.value, customer_name: c?.name || '' })) }}>
              <option value="">请选择客户</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="回款金额（元）" required>
            <input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </FormField>
          <FormField label="回款日期" required>
            <input type="date" className="form-input" value={form.payment_date || ''} onChange={e => set('payment_date', e.target.value)} />
          </FormField>
          <FormField label="收款方式">
            <select className="form-select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>
          <FormField label="账户信息">
            <input className="form-input" value={form.bank_account || ''} onChange={e => set('bank_account', e.target.value)} placeholder="银行卡号/账户" />
          </FormField>
          <div className="col-span-2"><FormField label="备注"><textarea className="form-textarea" rows={3} value={form.remark || ''} onChange={e => set('remark', e.target.value)} placeholder="备注信息..." /></FormField></div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, id: null })}
        onConfirm={handleConfirm} title="确认回款" message="确认此笔回款已实际到账吗？" />
      <ConfirmDialog open={delConfirm.open} onClose={() => setDelConfirm({ open: false, id: null })}
        onConfirm={handleDelete} title="删除回款记录" message="确定要删除此回款记录吗？" />
    </div>
  )
}
