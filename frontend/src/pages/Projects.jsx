import { useState, useEffect, useCallback } from 'react'
import { projectsAPI, customersAPI, systemAPI } from '../api'
import { useNotifyStore } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, ProgressBar, Tabs } from '../components/common'
import { Badge, fmt } from '../hooks'

const STATUS_OPTS = [
  { value: 'planning', label: '规划中' }, { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' }, { value: 'suspended', label: '已暂停' },
  { value: 'cancelled', label: '已取消' },
]
const PRIORITY_OPTS = [{ value: 'low', label: '低' }, { value: 'normal', label: '普通' }, { value: 'high', label: '高' }, { value: 'urgent', label: '紧急' }]
const TASK_STATUS = [{ value: 'todo', label: '待处理' }, { value: 'in_progress', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'cancelled', label: '已取消' }]

const INIT_FORM = { name: '', customer_id: '', customer_name: '', manager_id: '', start_date: '', end_date: '', budget: '', status: 'planning', priority: 'normal', description: '' }
const INIT_TASK = { name: '', assignee_id: '', start_date: '', due_date: '', status: 'todo', priority: 'normal', progress: 0, description: '' }

export default function Projects() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', status: '' })
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [detailModal, setDetailModal] = useState({ open: false, data: null, tab: 'info' })
  const [form, setForm] = useState(INIT_FORM)
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null })
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [taskModal, setTaskModal] = useState({ open: false, projectId: null, mode: 'create', data: null })
  const [taskForm, setTaskForm] = useState(INIT_TASK)
  const notify = useNotifyStore(s => s.notify)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await projectsAPI.list({ page, pageSize: PAGE_SIZE, ...filters })
      setList(res.data.list); setTotal(res.data.total)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    customersAPI.list({ pageSize: 200 }).then(r => setCustomers(r.data.list))
    systemAPI.listUsers({ pageSize: 200 }).then(r => setUsers(r.data.list))
  }, [])

  const openCreate = () => { setForm(INIT_FORM); setModal({ open: true, mode: 'create', data: null }) }
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: 'edit', data: row }) }

  const openDetail = async (row) => {
    const res = await projectsAPI.get(row.id)
    setDetailModal({ open: true, data: res.data, tab: 'info' })
  }

  const handleSave = async () => {
    if (!form.name) return notify('error', '项目名称必填')
    setSaving(true)
    try {
      if (modal.mode === 'create') { await projectsAPI.create(form); notify('success', '项目创建成功') }
      else { await projectsAPI.update(modal.data.id, form); notify('success', '项目更新成功') }
      setModal({ ...modal, open: false }); load()
    } catch (e) { notify('error', e?.message || '操作失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await projectsAPI.remove(delConfirm.id); notify('success', '删除成功'); setDelConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '删除失败') }
  }

  const handleTaskSave = async () => {
    if (!taskForm.name) return notify('error', '任务名称必填')
    try {
      if (taskModal.mode === 'create') { await projectsAPI.createTask(taskModal.projectId, taskForm) }
      else { await projectsAPI.updateTask(taskModal.projectId, taskModal.data.id, taskForm) }
      notify('success', '保存成功')
      setTaskModal({ ...taskModal, open: false })
      const res = await projectsAPI.get(taskModal.projectId)
      setDetailModal(d => ({ ...d, data: res.data }))
    } catch (e) { notify('error', e?.message || '操作失败') }
  }

  const handleDeleteTask = async (projectId, taskId) => {
    try {
      await projectsAPI.deleteTask(projectId, taskId)
      notify('success', '任务已删除')
      const res = await projectsAPI.get(projectId)
      setDetailModal(d => ({ ...d, data: res.data }))
    } catch (e) { notify('error', e?.message || '操作失败') }
  }

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const getProgressColor = (p) => {
    if (p >= 80) return 'bg-emerald-500'
    if (p >= 50) return 'bg-blue-500'
    if (p >= 30) return 'bg-amber-500'
    return 'bg-gray-400'
  }

  const columns = [
    { key: 'project_no', title: '项目编号', render: v => <span className="font-mono text-xs text-gray-500">{v}</span> },
    { key: 'name', title: '项目名称', render: (v, r) => (
      <button className="font-medium text-blue-600 hover:underline text-left" onClick={() => openDetail(r)}>{v}</button>
    )},
    { key: 'customer_name', title: '客户' },
    { key: 'status', title: '状态', render: v => <Badge status={v} /> },
    { key: 'priority', title: '优先级', render: v => <Badge status={v} /> },
    { key: 'progress', title: '进度', render: v => <div className="w-28"><ProgressBar value={v} color={getProgressColor(v)} /></div> },
    { key: 'end_date', title: '截止日期', render: (v, r) => {
      const overdue = v && new Date(v) < new Date() && r.status !== 'completed'
      return <span className={overdue ? 'text-red-500 font-medium' : ''}>{fmt.date(v)}</span>
    }},
    { key: 'manager_name', title: '项目经理' },
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

  const d = detailModal.data

  return (
    <div className="animate-fade-in">
      <PageHeader title="项目管理" desc="管理项目生命周期，跟踪项目进度，协同团队工作"
        actions={<button className="btn-primary" onClick={openCreate}>＋ 新建项目</button>} />

      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v => setFilter('keyword', v)} placeholder="搜索项目名称、编号、客户..." onSearch={load} />
        <select className="form-select w-32" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">全部状态</option>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={() => { setFilters({ keyword: '', status: '' }); setPage(1) }}>重置</button>
      </div>

      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} /></div>
      </div>

      {/* Project Form Modal */}
      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.mode === 'create' ? '新建项目' : '编辑项目'} width="max-w-2xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormField label="项目名称" required><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="请输入项目名称" /></FormField></div>
          <FormField label="关联客户">
            <select className="form-select" value={form.customer_id} onChange={e => { const c = customers.find(x => x.id == e.target.value); setForm(f => ({ ...f, customer_id: e.target.value, customer_name: c?.name || '' })) }}>
              <option value="">请选择</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="项目经理">
            <select className="form-select" value={form.manager_id} onChange={e => set('manager_id', e.target.value)}>
              <option value="">请选择</option>{users.map(u => <option key={u.id} value={u.id}>{u.real_name || u.username}</option>)}
            </select>
          </FormField>
          <FormField label="开始日期"><input type="date" className="form-input" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></FormField>
          <FormField label="计划结束日期"><input type="date" className="form-input" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></FormField>
          <FormField label="预算（元）"><input type="number" className="form-input" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0.00" /></FormField>
          <FormField label="优先级">
            <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="状态">
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          {modal.mode === 'edit' && (
            <FormField label="进度(%)"><input type="number" min="0" max="100" className="form-input" value={form.progress || 0} onChange={e => set('progress', e.target.value)} /></FormField>
          )}
          <div className="col-span-2"><FormField label="项目描述"><textarea className="form-textarea" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="项目背景和目标..." /></FormField></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {d && (
        <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false, data: null, tab: 'info' })}
          title={<div className="flex items-center gap-2">{d.name} <Badge status={d.status} /> <Badge status={d.priority} /></div>}
          width="max-w-4xl"
          footer={<>
            <button className="btn-secondary" onClick={() => setDetailModal({ ...detailModal, open: false })}>关闭</button>
            <button className="btn-primary" onClick={() => { setDetailModal({ ...detailModal, open: false }); openEdit(d) }}>编辑项目</button>
          </>}
        >
          <Tabs active={detailModal.tab} onChange={t => setDetailModal(x => ({ ...x, tab: t }))} items={[
            { key: 'info', label: '项目信息' },
            { key: 'tasks', label: '任务列表', count: d.tasks?.length },
          ]} />

          {detailModal.tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                {[
                  ['项目编号', d.project_no], ['所属客户', d.customer_name], ['项目经理', d.manager_name],
                  ['开始日期', fmt.date(d.start_date)], ['计划结束', fmt.date(d.end_date)], ['实际结束', fmt.date(d.actual_end_date)],
                  ['项目预算', fmt.yuan(d.budget)], ['实际成本', fmt.yuan(d.actual_cost)],
                ].map(([l, v]) => (
                  <div key={l} className="flex gap-2"><span className="text-gray-400 flex-shrink-0 w-20">{l}</span><span className="text-gray-700">{v || '—'}</span></div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">整体进度</span>
                  <span className="text-sm font-bold text-gray-700">{d.progress}%</span>
                </div>
                <ProgressBar value={d.progress} color={d.progress >= 80 ? 'bg-emerald-500' : 'bg-blue-500'} showLabel={false} />
              </div>
              {d.description && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{d.description}</p>}
            </div>
          )}

          {detailModal.tab === 'tasks' && (
            <div>
              <div className="flex justify-end mb-3">
                <button className="btn-primary btn-sm" onClick={() => { setTaskForm(INIT_TASK); setTaskModal({ open: true, projectId: d.id, mode: 'create', data: null }) }}>＋ 添加任务</button>
              </div>
              <div className="space-y-2">
                {d.tasks?.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'completed' ? 'bg-emerald-400' : t.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.name}</span>
                        <Badge status={t.priority} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{t.assignee_name || '未分配'}</span>
                        {t.due_date && <span>截止：{fmt.date(t.due_date)}</span>}
                      </div>
                    </div>
                    <div className="w-24 flex-shrink-0"><ProgressBar value={t.progress} showLabel={true} /></div>
                    <div className="flex items-center gap-1">
                      <button className="btn-icon text-xs" onClick={() => { setTaskForm({ ...t }); setTaskModal({ open: true, projectId: d.id, mode: 'edit', data: t }) }}>✏️</button>
                      <button className="btn-icon text-xs" onClick={() => handleDeleteTask(d.id, t.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
                {(!d.tasks || d.tasks.length === 0) && <div className="text-center py-8 text-gray-400">暂无任务，点击"添加任务"开始</div>}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Task Form Modal */}
      <Modal open={taskModal.open} onClose={() => setTaskModal({ ...taskModal, open: false })}
        title={taskModal.mode === 'create' ? '新建任务' : '编辑任务'} width="max-w-lg"
        footer={<>
          <button className="btn-secondary" onClick={() => setTaskModal({ ...taskModal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleTaskSave}>保存</button>
        </>}
      >
        <div className="space-y-4">
          <FormField label="任务名称" required><input className="form-input" value={taskForm.name} onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))} placeholder="任务名称" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="负责人">
              <select className="form-select" value={taskForm.assignee_id} onChange={e => setTaskForm(f => ({ ...f, assignee_id: e.target.value }))}>
                <option value="">请选择</option>{users.map(u => <option key={u.id} value={u.id}>{u.real_name || u.username}</option>)}
              </select>
            </FormField>
            <FormField label="优先级">
              <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                {[{ value: 'low', label: '低' }, { value: 'normal', label: '普通' }, { value: 'high', label: '高' }, { value: 'urgent', label: '紧急' }].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField label="开始日期"><input type="date" className="form-input" value={taskForm.start_date || ''} onChange={e => setTaskForm(f => ({ ...f, start_date: e.target.value }))} /></FormField>
            <FormField label="截止日期"><input type="date" className="form-input" value={taskForm.due_date || ''} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} /></FormField>
            <FormField label="状态">
              <select className="form-select" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
                {TASK_STATUS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField label="完成进度(%)"><input type="number" min="0" max="100" className="form-input" value={taskForm.progress || 0} onChange={e => setTaskForm(f => ({ ...f, progress: e.target.value }))} /></FormField>
          </div>
          <FormField label="任务描述"><textarea className="form-textarea" rows={3} value={taskForm.description || ''} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="任务详情..." /></FormField>
        </div>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={() => setDelConfirm({ open: false, id: null })}
        onConfirm={handleDelete} title="删除项目" message="确定要删除此项目吗？项目下所有任务也将被删除。" />
    </div>
  )
}
