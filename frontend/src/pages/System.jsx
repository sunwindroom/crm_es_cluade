import { useState, useEffect, useCallback } from 'react'
import { systemAPI } from '../api'
import { useNotifyStore } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, Tabs } from '../components/common'
import { fmt } from '../hooks'

// ─── Users Management ─────────────────────────────────────────────────────────
export function UsersManagement() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ keyword: '', status: '', role_id: '' })
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [form, setForm] = useState({ username: '', password: '', real_name: '', email: '', phone: '', role_id: '', department: '', position: '', status: 1 })
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null })
  const [resetModal, setResetModal] = useState({ open: false, id: null })
  const [newPwd, setNewPwd] = useState('')
  const [roles, setRoles] = useState([])
  const notify = useNotifyStore(s => s.notify)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await systemAPI.listUsers({ page, pageSize: PAGE_SIZE, ...filters })
      setList(res.data.list); setTotal(res.data.total)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])
  useEffect(() => { systemAPI.listRoles().then(r => setRoles(r.data)) }, [])

  const openCreate = () => {
    setForm({ username: '', password: '', real_name: '', email: '', phone: '', role_id: '', department: '', position: '', status: 1 })
    setModal({ open: true, mode: 'create', data: null })
  }
  const openEdit = (row) => { setForm({ ...row, password: '' }); setModal({ open: true, mode: 'edit', data: row }) }

  const handleSave = async () => {
    if (!form.username || (modal.mode === 'create' && !form.password)) return notify('error', '用户名和密码必填')
    setSaving(true)
    try {
      if (modal.mode === 'create') { await systemAPI.createUser(form); notify('success', '用户创建成功') }
      else { await systemAPI.updateUser(modal.data.id, form); notify('success', '用户更新成功') }
      setModal({ ...modal, open: false }); load()
    } catch (e) { notify('error', e?.message || '操作失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await systemAPI.deleteUser(delConfirm.id); notify('success', '删除成功'); setDelConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '删除失败') }
  }

  const handleResetPwd = async () => {
    if (!newPwd) return notify('error', '新密码不能为空')
    try { await systemAPI.resetPassword(resetModal.id, { new_password: newPwd }); notify('success', '密码重置成功'); setResetModal({ open: false, id: null }); setNewPwd('') }
    catch (e) { notify('error', e?.message || '操作失败') }
  }

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const columns = [
    { key: 'username', title: '用户名', render: (v, r) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">{(r.real_name || v)[0]?.toUpperCase()}</div>
        <div><div className="font-medium text-gray-800">{v}</div><div className="text-xs text-gray-400">{r.real_name}</div></div>
      </div>
    )},
    { key: 'role_name', title: '角色', render: v => v ? <span className="badge-blue">{v}</span> : '—' },
    { key: 'department', title: '部门', render: v => v || '—' },
    { key: 'email', title: '邮箱' },
    { key: 'status', title: '状态', render: v => v ? <span className="badge-green">启用</span> : <span className="badge-red">禁用</span> },
    { key: 'last_login', title: '最后登录', render: v => fmt.datetime(v) },
    {
      key: 'actions', title: '操作', width: '200px',
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={() => openEdit(r)}>编辑</button>
          <button className="btn btn-sm text-amber-600 hover:bg-amber-50 border-0 shadow-none" onClick={() => { setResetModal({ open: true, id: r.id }); setNewPwd('') }}>重置密码</button>
          <button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={() => setDelConfirm({ open: true, id: r.id })}>删除</button>
        </div>
      )
    },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="用户管理" desc="管理系统用户账号、角色分配和访问权限"
        actions={<button className="btn-primary" onClick={openCreate}>＋ 新建用户</button>} />

      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v => setFilter('keyword', v)} placeholder="搜索用户名、姓名、邮箱..." onSearch={load} />
        <select className="form-select w-28" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
        <select className="form-select w-32" value={filters.role_id} onChange={e => setFilter('role_id', e.target.value)}>
          <option value="">全部角色</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={() => { setFilters({ keyword: '', status: '', role_id: '' }); setPage(1) }}>重置</button>
      </div>

      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} /></div>
      </div>

      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.mode === 'create' ? '新建用户' : '编辑用户'} width="max-w-2xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="用户名" required><input className="form-input" value={form.username} onChange={e => set('username', e.target.value)} placeholder="登录用户名" disabled={modal.mode === 'edit'} /></FormField>
          {modal.mode === 'create' && <FormField label="初始密码" required><input type="password" className="form-input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="设置密码" /></FormField>}
          <FormField label="真实姓名"><input className="form-input" value={form.real_name || ''} onChange={e => set('real_name', e.target.value)} placeholder="姓名" /></FormField>
          <FormField label="角色">
            <select className="form-select" value={form.role_id || ''} onChange={e => set('role_id', e.target.value)}>
              <option value="">请选择角色</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </FormField>
          <FormField label="邮箱"><input className="form-input" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="邮箱地址" /></FormField>
          <FormField label="手机号"><input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="手机号码" /></FormField>
          <FormField label="部门"><input className="form-input" value={form.department || ''} onChange={e => set('department', e.target.value)} placeholder="所在部门" /></FormField>
          <FormField label="职位"><input className="form-input" value={form.position || ''} onChange={e => set('position', e.target.value)} placeholder="职位名称" /></FormField>
          {modal.mode === 'edit' && <FormField label="状态">
            <select className="form-select" value={form.status} onChange={e => set('status', parseInt(e.target.value))}>
              <option value={1}>启用</option>
              <option value={0}>禁用</option>
            </select>
          </FormField>}
        </div>
      </Modal>

      <Modal open={resetModal.open} onClose={() => setResetModal({ open: false, id: null })} title="重置密码" width="max-w-sm"
        footer={<>
          <button className="btn-secondary" onClick={() => setResetModal({ open: false, id: null })}>取消</button>
          <button className="btn-primary" onClick={handleResetPwd}>确认重置</button>
        </>}
      >
        <FormField label="新密码" required hint="密码长度至少6位">
          <input type="password" className="form-input" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="请输入新密码" />
        </FormField>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={() => setDelConfirm({ open: false, id: null })}
        onConfirm={handleDelete} title="删除用户" message="确定要删除此用户账号吗？此操作不可恢复。" />
    </div>
  )
}

// ─── Roles Management ─────────────────────────────────────────────────────────
const ALL_PERMS = [
  { module: 'leads', label: '线索管理' },
  { module: 'customers', label: '客户管理' },
  { module: 'opportunities', label: '商机管理' },
  { module: 'projects', label: '项目管理' },
  { module: 'contracts', label: '合同管理' },
  { module: 'payments', label: '回款管理' },
  { module: 'reports', label: '报表统计' },
  { module: 'system', label: '系统管理' },
]
const PERM_ACTIONS = [{ value: 'read', label: '查看' }, { value: 'write', label: '编辑' }, { value: 'delete', label: '删除' }]

export function RolesManagement() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null })
  const [form, setForm] = useState({ name: '', description: '', permissions: {} })
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState({ open: false, id: null })
  const notify = useNotifyStore(s => s.notify)

  const load = async () => {
    setLoading(true)
    try { const res = await systemAPI.listRoles(); setRoles(res.data) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm({ name: '', description: '', permissions: {} }); setModal({ open: true, mode: 'create', data: null }) }
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: 'edit', data: row }) }

  const handleSave = async () => {
    if (!form.name) return notify('error', '角色名称必填')
    setSaving(true)
    try {
      if (modal.mode === 'create') { await systemAPI.createRole(form); notify('success', '角色创建成功') }
      else { await systemAPI.updateRole(modal.data.id, form); notify('success', '角色更新成功') }
      setModal({ ...modal, open: false }); load()
    } catch (e) { notify('error', e?.message || '操作失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await systemAPI.deleteRole(delConfirm.id); notify('success', '删除成功'); setDelConfirm({ open: false, id: null }); load() }
    catch (e) { notify('error', e?.message || '删除失败') }
  }

  const togglePerm = (module, action) => {
    const perms = { ...form.permissions }
    if (!perms[module]) perms[module] = []
    if (perms[module].includes(action)) {
      perms[module] = perms[module].filter(a => a !== action)
    } else {
      perms[module] = [...perms[module], action]
    }
    setForm(f => ({ ...f, permissions: perms }))
  }

  const hasAllModule = (module) => PERM_ACTIONS.every(a => (form.permissions?.[module] || []).includes(a.value))
  const toggleAllModule = (module) => {
    const perms = { ...form.permissions }
    if (hasAllModule(module)) { perms[module] = [] } else { perms[module] = PERM_ACTIONS.map(a => a.value) }
    setForm(f => ({ ...f, permissions: perms }))
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="角色管理" desc="配置系统角色和权限，实现精细化访问控制"
        actions={<button className="btn-primary" onClick={openCreate}>＋ 新建角色</button>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-3 text-center py-16 text-gray-400">加载中...</div> :
          roles.map(role => (
            <div key={role.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{role.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                </div>
                <span className="badge-blue">{role.user_count || 0} 人</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {ALL_PERMS.filter(p => role.permissions?.[p.module]?.length > 0).map(p => (
                  <span key={p.module} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{p.label}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button className="btn-secondary btn-sm flex-1 justify-center" onClick={() => openEdit(role)}>编辑权限</button>
                <button className="btn-icon" onClick={() => setDelConfirm({ open: true, id: role.id })}>🗑️</button>
              </div>
            </div>
          ))
        }
      </div>

      <Modal open={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.mode === 'create' ? '新建角色' : '编辑角色'} width="max-w-2xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setModal({ ...modal, open: false })}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </>}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="角色名称" required><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：销售经理" /></FormField>
            <FormField label="描述"><input className="form-input" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="角色职责说明" /></FormField>
          </div>
          <div>
            <label className="form-label mb-3 block">权限配置</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-5 gap-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">模块</span>
                <span className="text-xs font-semibold text-gray-500 text-center">全选</span>
                {PERM_ACTIONS.map(a => <span key={a.value} className="text-xs font-semibold text-gray-500 text-center">{a.label}</span>)}
              </div>
              {ALL_PERMS.map(perm => (
                <div key={perm.module} className="grid grid-cols-5 gap-0 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <span className="text-sm text-gray-700 font-medium">{perm.label}</span>
                  <div className="flex justify-center">
                    <input type="checkbox" checked={hasAllModule(perm.module)} onChange={() => toggleAllModule(perm.module)} className="rounded" />
                  </div>
                  {PERM_ACTIONS.map(action => (
                    <div key={action.value} className="flex justify-center">
                      <input type="checkbox"
                        checked={(form.permissions?.[perm.module] || []).includes(action.value)}
                        onChange={() => togglePerm(perm.module, action.value)}
                        className="rounded" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={() => setDelConfirm({ open: false, id: null })}
        onConfirm={handleDelete} title="删除角色" message="确定要删除此角色吗？请确保无用户使用此角色。" />
    </div>
  )
}
