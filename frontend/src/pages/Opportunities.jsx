import { useState, useEffect, useCallback } from 'react'
import { oppsAPI, customersAPI } from '../api'
import { useNotifyStore } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, ProgressBar } from '../components/common'
import { Badge, fmt } from '../hooks'

const STAGES = [
  { value: 'prospecting', label: '意向挖掘', prob: 10, color: 'bg-blue-400' },
  { value: 'qualification', label: '需求确认', prob: 30, color: 'bg-purple-400' },
  { value: 'proposal', label: '方案报价', prob: 50, color: 'bg-amber-400' },
  { value: 'negotiation', label: '商务谈判', prob: 70, color: 'bg-orange-400' },
  { value: 'closed_won', label: '赢单', prob: 100, color: 'bg-emerald-400' },
  { value: 'closed_lost', label: '输单', prob: 0, color: 'bg-red-400' },
]

const INIT_FORM = { name: '', customer_id: '', customer_name: '', amount: '', stage: 'prospecting', probability: 10, expected_close_date: '', source: '', product: '', remark: '' }

export default function Opportunities() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', stage: '', status: 'open' })
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [form, setForm] = useState(INIT_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null })
  const [customers, setCustomers] = useState([])
  const [viewMode, setViewMode] = useState('list')
  const [kanban, setKanban] = useState({})
  const notify = useNotifyStore(s => s.notify)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await oppsAPI.list({ page, pageSize: PAGE_SIZE, ...filters })
      setList(res.data.list); setTotal(res.data.total)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    customersAPI.list({ pageSize: 200 }).then(r => setCustomers(r.data.list))
  }, [])

  const openCreate = () => { setForm(INIT_FORM); setModal({ open: true, mode: 'create', data: null }) }
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: 'edit', data: row }) }

  const handleSave = async () => {
    if (!form.name) return notify('error', '商机名称必填')
    setSaving(true)
    try {
      if (modal.mode === 'create') { await oppsAPI.create(form); notify('success', '商机创建成功') }
      else { await oppsAPI.update(modal.data.id, form); notify('success', '商机更新成功') }
      setModal({ ...modal, open: false }); load()
    } catch (e) { notify('error', e?.message || '操作失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await oppsAPI.remove(delConfirm.id); notify('success', '删除成功'); setDelConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '删除失败') }
  }

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleStageChange = (v) => {
    const s = STAGES.find(x => x.value === v)
    setForm(f => ({ ...f, stage: v, probability: s?.prob || f.probability }))
  }

  const columns = [
    { key: 'name', title: '商机名称', render: (v, r) => <span className="font-medium text-gray-800">{v}</span> },
    { key: 'customer_name', title: '客户' },
    { key: 'amount', title: '金额', render: v => <span className="font-semibold text-gray-800">{fmt.yuan(v)}</span>, align: 'right' },
    { key: 'stage', title: '阶段', render: v => <Badge status={v} /> },
    { key: 'probability', title: '赢率', render: v => (
      <div className="flex items-center gap-2 w-24">
        <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${v}%` }} />
        </div>
        <span className="text-xs text-gray-500">{v}%</span>
      </div>
    )},
    { key: 'expected_close_date', title: '预计成交', render: v => fmt.date(v) },
    { key: 'owner_name', title: '负责人' },
    {
      key: 'actions', title: '操作', width: '120px',
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={() => openEdit(r)}>编辑</button>
          <button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={() => setDelConfirm({ open: true, id: r.id })}>删除</button>
        </div>
      )
    },
  ]

  // Kanban board
  const kanbanData = STAGES.slice(0, 4).map(s => ({
    ...s,
    items: list.filter(o => o.stage === s.value)
  }))

  return (
    <div className="animate-fade-in">
      <PageHeader title="商机管理" desc="跟踪销售机会，推进商机阶段，提升赢单率"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} onClick={() => setViewMode('list')}>列表</button>
              <button className={`px-3 py-1.5 text-sm ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} onClick={() => setViewMode('kanban')}>看板</button>
            </div>
            <button className="btn-primary" onClick={openCreate}>＋ 新建商机</button>
          </div>
        }
      />

      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v => setFilter('keyword', v)} placeholder="搜索商机名称、客户名称..." onSearch={load} />
        <select className="form-select w-32" value={filters.stage} onChange={e => setFilter('stage', e.target.value)}>
          <option value="">全部阶段</option>
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-select w-28" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">全部</option>
          <option value="open">进行中</option>
          <option value="closed_won">赢单</option>
          <option value="closed_lost">输单</option>
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={() => { setFilters({ keyword: '', stage: '', status: 'open' }); setPage(1) }}>重置</button>
      </div>

      {viewMode === 'list' ? (
        <div className="card">
          <Table columns={columns} data={list} loading={loading} />
          <div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} /></div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanData.map(col => (
            <div key={col.value} className="flex-shrink-0 w-72">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl text-white text-sm font-medium ${col.color}`}>
                <span>{col.label}</span>
                <span className="ml-auto bg-white/30 rounded-full px-2 py-0.5 text-xs">{col.items.length}</span>
              </div>
              <div className="bg-gray-100 rounded-b-xl p-2 space-y-2 min-h-48">
                {col.items.map(item => (
                  <div key={item.id} className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(item)}>
                    <div className="font-medium text-sm text-gray-800 mb-1">{item.name}</div>
                    <div className="text-xs text-gray-500 mb-2">{item.customer_name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-600">{fmt.yuan(item.amount)}</span>
                      <span className="text-xs text-gray-400">{item.probability}%</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">{item.owner_name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.mode === 'create' ? '新建商机' : '编辑商机'} width="max-w-2xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="商机名称" required><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="请输入商机名称" /></FormField>
          </div>
          <FormField label="关联客户">
            <select className="form-select" value={form.customer_id} onChange={e => {
              const c = customers.find(x => x.id == e.target.value)
              setForm(f => ({ ...f, customer_id: e.target.value, customer_name: c?.name || '' }))
            }}>
              <option value="">请选择客户</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="商机金额（元）">
            <input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </FormField>
          <FormField label="商机阶段">
            <select className="form-select" value={form.stage} onChange={e => handleStageChange(e.target.value)}>
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="赢率(%)">
            <input type="number" min="0" max="100" className="form-input" value={form.probability} onChange={e => set('probability', e.target.value)} />
          </FormField>
          <FormField label="预计成交日期">
            <input type="date" className="form-input" value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} />
          </FormField>
          <FormField label="产品/服务"><input className="form-input" value={form.product} onChange={e => set('product', e.target.value)} placeholder="相关产品或服务" /></FormField>
          <div className="col-span-2">
            <FormField label="备注"><textarea className="form-textarea" rows={3} value={form.remark} onChange={e => set('remark', e.target.value)} placeholder="备注..." /></FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={() => setDelConfirm({ open: false, id: null })}
        onConfirm={handleDelete} title="删除商机" message="确定要删除此商机吗？" />
    </div>
  )
}
