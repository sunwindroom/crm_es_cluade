import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api'
import { useAuthStore, useNotifyStore } from '../store'

export default function Login() {
  const [form, setForm] = useState({ username: 'admin', password: 'Admin@123' })
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const notify = useNotifyStore(s => s.notify)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) return notify('error', '请填写用户名和密码')
    setLoading(true)
    try {
      const res = await authAPI.login(form)
      if (res.code === 200) {
        setAuth(res.data.user, res.data.token)
        notify('success', `欢迎回来，${res.data.user.real_name || res.data.user.username}！`)
        navigate('/')
      }
    } catch (err) {
      notify('error', err?.message || '登录失败')
    } finally { setLoading(false) }
  }

  const DEMO_ACCOUNTS = [
    { username:'admin', label:'系统管理员', color:'bg-gray-100 text-gray-700' },
    { username:'president', label:'总裁', color:'bg-purple-100 text-purple-700' },
    { username:'mkt_vp', label:'营销副总裁', color:'bg-blue-100 text-blue-700' },
    { username:'tech_vp', label:'技术副总裁', color:'bg-green-100 text-green-700' },
    { username:'sm001', label:'销售经理', color:'bg-orange-100 text-orange-700' },
    { username:'sales001', label:'销售', color:'bg-amber-100 text-amber-700' },
    { username:'finance001', label:'财务', color:'bg-teal-100 text-teal-700' },
  ]

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600">
      <div className="hidden lg:flex lg:flex-1 flex-col items-center justify-center p-12 text-white">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-5xl mb-6 backdrop-blur">📊</div>
        <h1 className="text-4xl font-bold mb-4">CRM 客户关系管理</h1>
        <p className="text-blue-200 text-lg text-center max-w-md leading-relaxed">全流程管理：线索→客户→商机→项目→合同→回款，完整权限体系与层级管理</p>
        <div className="grid grid-cols-3 gap-4 mt-10 w-full max-w-md">
          {[{icon:'🎯',label:'线索管理'},{icon:'👥',label:'客户管理'},{icon:'💡',label:'商机管理'},{icon:'📁',label:'项目管理'},{icon:'📄',label:'合同管理'},{icon:'💰',label:'回款管理'}].map(f=>(
            <div key={f.label} className="flex flex-col items-center gap-2 bg-white/10 rounded-xl p-4 backdrop-blur">
              <span className="text-2xl">{f.icon}</span><span className="text-xs text-blue-100">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full lg:w-[440px] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">C</div>
            <div><h2 className="text-xl font-bold text-gray-800">CRM 系统 v2.0</h2><p className="text-xs text-gray-400">完整权限管理版</p></div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">欢迎登录</h3>
          <p className="text-gray-500 text-sm mb-6">请输入您的账号和密码</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="form-group">
              <label className="form-label form-label-required">用户名</label>
              <input className="form-input" placeholder="请输入用户名" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} autoFocus/>
            </div>
            <div className="form-group">
              <label className="form-label form-label-required">密码</label>
              <input type="password" className="form-input" placeholder="请输入密码" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2 text-base" disabled={loading}>
              {loading?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> 登录中...</>:'登 录'}
            </button>
          </form>
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-3">演示账号（密码均为 Admin@123）</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map(a=>(
                <button key={a.username} onClick={()=>setForm({username:a.username,password:'Admin@123'})}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all hover:opacity-80 ${a.color}`}>{a.label}</button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">点击角色名称快速填入账号</p>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">CRM v2.0 · React + Node.js · 完整权限体系</p>
        </div>
      </div>
    </div>
  )
}
