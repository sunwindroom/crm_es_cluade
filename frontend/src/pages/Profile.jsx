import { useState } from 'react'
import { authAPI } from '../api'
import { useAuthStore, useNotifyStore } from '../store'
import { FormField } from '../components/common'
import { fmt } from '../hooks'

export default function Profile() {
  const { user, updateUser } = useAuthStore()
  const notify = useNotifyStore(s => s.notify)
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({ real_name: user?.real_name || '', email: user?.email || '', phone: user?.phone || '', department: user?.department || '', position: user?.position || '' })
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await authAPI.updateProfile(form)
      updateUser({ ...user, ...form })
      notify('success', '个人信息更新成功')
    } catch (e) { notify('error', e?.message || '更新失败') }
    finally { setSaving(false) }
  }

  const handleChangePwd = async () => {
    if (!pwdForm.old_password || !pwdForm.new_password) return notify('error', '请填写完整信息')
    if (pwdForm.new_password !== pwdForm.confirm_password) return notify('error', '两次密码不一致')
    if (pwdForm.new_password.length < 6) return notify('error', '新密码至少6位')
    setSaving(true)
    try {
      await authAPI.changePassword({ old_password: pwdForm.old_password, new_password: pwdForm.new_password })
      notify('success', '密码修改成功，请重新登录')
      setPwdForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (e) { notify('error', e?.message || '修改失败') }
    finally { setSaving(false) }
  }

  const TABS = [{ key: 'info', label: '基本信息' }, { key: 'password', label: '修改密码' }, { key: 'about', label: '关于系统' }]

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">个人中心</h2>
        <p className="text-sm text-gray-500 mt-1">管理您的个人信息和账号安全</p>
      </div>

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            {(user?.real_name || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800">{user?.real_name || user?.username}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="badge-blue">{user?.role_name || '暂无角色'}</span>
              {user?.department && <span className="text-sm text-gray-500">{user.department}</span>}
              {user?.position && <span className="text-sm text-gray-500">· {user.position}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>上次登录</div>
            <div className="font-medium text-gray-700">{fmt.datetime(user?.last_login) || '—'}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {TABS.map(t => (
          <button key={t.key} className={`tab-item ${tab === t.key ? 'tab-item-active' : 'tab-item-inactive'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card p-6">
          <div className="grid grid-cols-2 gap-5">
            <FormField label="真实姓名"><input className="form-input" value={form.real_name} onChange={e => set('real_name', e.target.value)} placeholder="请输入真实姓名" /></FormField>
            <FormField label="用户名"><input className="form-input" value={user?.username || ''} disabled className="bg-gray-50" /></FormField>
            <FormField label="邮箱"><input className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="电子邮箱" /></FormField>
            <FormField label="手机号"><input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="手机号码" /></FormField>
            <FormField label="部门"><input className="form-input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="所在部门" /></FormField>
            <FormField label="职位"><input className="form-input" value={form.position} onChange={e => set('position', e.target.value)} placeholder="职位名称" /></FormField>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="btn-primary" onClick={handleSaveProfile} disabled={saving}>
              {saving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="card p-6 max-w-sm">
          <div className="space-y-4">
            <FormField label="当前密码" required>
              <input type="password" className="form-input" value={pwdForm.old_password} onChange={e => setPwdForm(f => ({ ...f, old_password: e.target.value }))} placeholder="请输入当前密码" />
            </FormField>
            <FormField label="新密码" required hint="密码长度至少6位">
              <input type="password" className="form-input" value={pwdForm.new_password} onChange={e => setPwdForm(f => ({ ...f, new_password: e.target.value }))} placeholder="请输入新密码" />
            </FormField>
            <FormField label="确认新密码" required>
              <input type="password" className="form-input" value={pwdForm.confirm_password} onChange={e => setPwdForm(f => ({ ...f, confirm_password: e.target.value }))} placeholder="再次输入新密码" />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="btn-primary" onClick={handleChangePwd} disabled={saving}>
              {saving ? '修改中...' : '确认修改'}
            </button>
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">C</div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">CRM 客户关系管理系统</h3>
              <p className="text-gray-500 text-sm">版本 v1.0.0</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-gray-600">
            <p>本系统是一套完整的企业级客户关系管理平台，提供从线索获取到回款的全流程管理能力。</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['前端技术', 'React 18 + Tailwind CSS'],
                ['后端技术', 'Node.js + Express'],
                ['数据库', 'SQLite (better-sqlite3)'],
                ['图表库', 'Recharts'],
                ['认证方式', 'JWT Token'],
                ['构建工具', 'Vite'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2 bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-400 w-20 flex-shrink-0">{k}</span>
                  <span className="font-medium text-gray-700">{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-blue-700 text-sm">
              <strong>功能模块：</strong>线索管理、客户管理、商机管理（看板视图）、项目管理（任务跟踪）、合同管理（审批流程）、回款管理（财务确认）、报表统计（多维分析）、系统管理（用户/角色/权限）
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
