import { useState } from 'react'
import { authAPI } from '../api'
import { useAuthStore, useNotifyStore } from '../store'
import { FormField } from '../components/common'
import { fmt } from '../hooks'

export default function Profile() {
  const { user, updateUser } = useAuthStore()
  const notify = useNotifyStore(s => s.notify)
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({ real_name: user?.real_name||'', email: user?.email||'', phone: user?.phone||'', department: user?.department||'', position: user?.position||'' })
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSaveProfile = async () => {
    setSaving(true)
    try { await authAPI.updateProfile(form); updateUser({...user,...form}); notify('success','个人信息更新成功') }
    catch(e) { notify('error', e?.message||'更新失败') } finally { setSaving(false) }
  }
  const handleChangePwd = async () => {
    if (!pwdForm.old_password||!pwdForm.new_password) return notify('error','请填写完整信息')
    if (pwdForm.new_password !== pwdForm.confirm_password) return notify('error','两次密码不一致')
    if (pwdForm.new_password.length < 6) return notify('error','新密码至少6位')
    setSaving(true)
    try { await authAPI.changePassword({old_password:pwdForm.old_password,new_password:pwdForm.new_password}); notify('success','密码修改成功'); setPwdForm({old_password:'',new_password:'',confirm_password:''}) }
    catch(e) { notify('error', e?.message||'修改失败') } finally { setSaving(false) }
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6"><h2 className="text-xl font-bold text-gray-800">个人中心</h2><p className="text-sm text-gray-500 mt-1">管理您的个人信息和账号安全</p></div>
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            {(user?.real_name||user?.username||'U')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800">{user?.real_name||user?.username}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="badge-blue">{user?.role_name||'暂无角色'}</span>
              {user?.department&&<span className="text-sm text-gray-500">{user.department}</span>}
              {user?.position&&<span className="text-sm text-gray-500">· {user.position}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500"><div>上次登录</div><div className="font-medium text-gray-700">{fmt.datetime(user?.last_login)||'—'}</div></div>
        </div>
      </div>
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {[{key:'info',label:'基本信息'},{key:'password',label:'修改密码'},{key:'about',label:'关于系统'}].map(t=>(
          <button key={t.key} className={`tab-item ${tab===t.key?'tab-item-active':'tab-item-inactive'}`} onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab==='info'&&<div className="card p-6">
        <div className="grid grid-cols-2 gap-5">
          <FormField label="真实姓名"><input className="form-input" value={form.real_name} onChange={e=>set('real_name',e.target.value)} placeholder="请输入真实姓名"/></FormField>
          <FormField label="用户名"><input className="form-input" value={user?.username||''} disabled className="bg-gray-50"/></FormField>
          <FormField label="邮箱"><input className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="电子邮箱"/></FormField>
          <FormField label="手机号"><input className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="手机号码"/></FormField>
          <FormField label="部门"><input className="form-input" value={form.department} onChange={e=>set('department',e.target.value)} placeholder="所在部门"/></FormField>
          <FormField label="职位"><input className="form-input" value={form.position} onChange={e=>set('position',e.target.value)} placeholder="职位名称"/></FormField>
        </div>
        <div className="mt-6 flex justify-end"><button className="btn-primary" onClick={handleSaveProfile} disabled={saving}>{saving?'保存中...':'保存修改'}</button></div>
      </div>}
      {tab==='password'&&<div className="card p-6 max-w-sm">
        <div className="space-y-4">
          <FormField label="当前密码" required><input type="password" className="form-input" value={pwdForm.old_password} onChange={e=>setPwdForm(f=>({...f,old_password:e.target.value}))} placeholder="请输入当前密码"/></FormField>
          <FormField label="新密码" required hint="密码长度至少6位"><input type="password" className="form-input" value={pwdForm.new_password} onChange={e=>setPwdForm(f=>({...f,new_password:e.target.value}))} placeholder="请输入新密码"/></FormField>
          <FormField label="确认新密码" required><input type="password" className="form-input" value={pwdForm.confirm_password} onChange={e=>setPwdForm(f=>({...f,confirm_password:e.target.value}))} placeholder="再次输入新密码"/></FormField>
        </div>
        <div className="mt-6 flex justify-end"><button className="btn-primary" onClick={handleChangePwd} disabled={saving}>{saving?'修改中...':'确认修改'}</button></div>
      </div>}
      {tab==='about'&&<div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">C</div>
          <div><h3 className="text-xl font-bold text-gray-800">CRM 客户关系管理系统</h3><p className="text-gray-500 text-sm">版本 v2.0.0 | 完整权限体系版</p></div>
        </div>
        <div className="space-y-3 text-sm text-gray-600">
          <p>完整企业级 CRM 系统，包含线索→客户→商机→项目→合同→回款全流程管理，支持多级角色权限体系、离职移交、回款倒计时、甘特图、工时统计等功能。</p>
          <div className="grid grid-cols-2 gap-3">
            {[['前端技术','React 18 + Tailwind CSS'],['后端技术','Node.js + Express'],['数据库','SQLite (better-sqlite3)'],['认证方式','JWT Token'],['角色体系','8种角色，层级权限'],['新增功能','甘特图/工时/里程碑/倒计时/离职移交']].map(([k,v])=>(
              <div key={k} className="flex gap-2 bg-gray-50 rounded-lg p-3">
                <span className="text-gray-400 w-20 flex-shrink-0">{k}</span>
                <span className="font-medium text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  )
}
