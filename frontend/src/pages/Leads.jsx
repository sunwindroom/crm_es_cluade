import { useState, useEffect, useCallback } from 'react'
import { leadsAPI } from '../api'
import { useNotifyStore } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, EmptyState } from '../components/common'
import { Badge, fmt, LEAD_SOURCES, INDUSTRIES, REGIONS } from '../hooks'

const STATUS_OPTS = [
  { value: 'new', label: '新线索' },
  { value: 'contacted', label: '已联系' },
  { value: 'qualified', label: '已确认' },
  { value: 'converted', label: '已转化' },
  { value: 'lost', label: '已失效' },
]

const INIT_FORM = { title: '', company: '', contact_name: '', contact_phone: '', contact_email: '', source: '', status: 'new', industry: '', region: '', remark: '', owner_id: '' }

export default function Leads() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', status: '', source: '' })
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [form, setForm] = useState(INIT_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null })
  const [convertConfirm, setConvertConfirm] = useState({ open: false, id: null })
  const notify = useNotifyStore(s => s.notify)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await leadsAPI.list({ page, pageSize: PAGE_SIZE, ...filters })
      setList(res.data.list)
      setTotal(res.data.total)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm(INIT_FORM); setModal({ open: true, mode: 'create', data: null }) }
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: 'edit', data: row }) }

  const handleSave = async () => {
    if (!form.title) return notify('error', '线索标题必填')
    setSaving(true)
    try {
      if (modal.mode === 'create') { await leadsAPI.create(form); notify('success', '线索创建成功') }
      else { await leadsAPI.update(modal.data.id, form); notify('success', '线索更新成功') }
      setModal({ ...modal, open: false })
      load()
    } catch (e) { notify('error', e?.message || '操作失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await leadsAPI.remove(delConfirm.id); notify('success', '删除成功'); setDelConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '删除失败') }
  }

  const handleConvert = async () => {
    try { await leadsAPI.convert(convertConfirm.id); notify('success', '线索已转化为客户'); setConvertConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '转化失败') }
  }

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const columns = [
    { key: 'title', title: '线索名称', render: (v, r) => <span className="font-medium text-gray-800">{v}</span> },
    { key: 'company', title: '公司' },
    { key: 'contact_name', title: '联系人', render: (v, r) => <span>{v} <span className="text-gray-400 text-xs">{r.contact_phone}</span></span> },
    { key: 'source', title: '来源', render: v => v || '—' },
    { key: 'status', title: '状态', render: v => <Badge status={v} /> },
    { key: 'owner_name', title: '负责人' },
    { key: 'created_at', title: '创建时间', render: v => fmt.date(v) },
    {
      key: 'actions', title: '操作', width: '160px',
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={() => openEdit(r)}>编辑</button>
          {!r.converted && (
            <button className="btn btn-sm text-emerald-600 hover:bg-emerald-50 border-0 shadow-none" onClick={() => setConvertConfirm({ open: true, id: r.id })}>转化</button>
          )}
          <button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={() => setDelConfirm({ open: true, id: r.id })}>删除</button>
        </div>
      )
    },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="线索管理" desc="管理销售线索，跟踪线索状态，转化为正式客户"
        actions={<button className="btn-primary" onClick={openCreate}>＋ 新建线索</button>} />

      {/* Filters */}
      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v => setFilter('keyword', v)} placeholder="搜索线索名称、公司、联系人..." onSearch={load} />
        <select className="form-select w-32" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">全部状态</option>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-select w-32" value={filters.source} onChange={e => setFilter('source', e.target.value)}>
          <option value="">全部来源</option>
          {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={() => { setFilters({ keyword: '', status: '', source: '' }); setPage(1) }}>重置</button>
      </div>

      {/* Table */}
      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <div className="px-4 pb-2">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* Form Modal */}
      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.mode === 'create' ? '新建线索' : '编辑线索'}
        width="max-w-3xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="线索名称" required><input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="请输入线索名称" /></FormField>
          </div>
          <FormField label="公司名称"><input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="公司名称" /></FormField>
          <FormField label="联系人"><input className="form-input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="联系人姓名" /></FormField>
          <FormField label="联系电话"><input className="form-input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="手机号码" /></FormField>
          <FormField label="邮箱"><input className="form-input" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="电子邮箱" /></FormField>
          <FormField label="线索来源">
            <select className="form-select" value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="">请选择</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="状态">
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="所属行业">
            <select className="form-select" value={form.industry} onChange={e => set('industry', e.target.value)}>
              <option value="">请选择</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </FormField>
          <FormField label="所在地区">
            <select className="form-select" value={form.region} onChange={e => set('region', e.target.value)}>
              <option value="">请选择</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="备注"><textarea className="form-textarea" rows={3} value={form.remark} onChange={e => set('remark', e.target.value)} placeholder="备注信息..." /></FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={() => setDelConfirm({ open: false, id: null })}
        onConfirm={handleDelete} title="删除线索" message="确定要删除这条线索吗？删除后无法恢复。" />
      <ConfirmDialog open={convertConfirm.open} onClose={() => setConvertConfirm({ open: false, id: null })}
        onConfirm={handleConvert} title="转化线索" message="确定要将此线索转化为正式客户吗？" />
    </div>
  )
}
