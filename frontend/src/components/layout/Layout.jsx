import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore, useNotifyStore, useAppStore } from '../../store'

const NAV_ITEMS = [
  { path: '/dashboard', icon: '📊', label: '工作台' },
  { path: '/leads', icon: '🎯', label: '线索管理' },
  { path: '/customers', icon: '👥', label: '客户管理' },
  { path: '/opportunities', icon: '💡', label: '商机管理' },
  { path: '/projects', icon: '📁', label: '项目管理' },
  { path: '/contracts', icon: '📄', label: '合同管理' },
  { path: '/payments', icon: '💰', label: '回款管理' },
  { path: '/reports', icon: '📈', label: '报表统计' },
  { divider: true },
  { path: '/system/users', icon: '👤', label: '用户管理' },
  { path: '/system/roles', icon: '🔑', label: '角色管理' },
  { path: '/profile', icon: '⚙️', label: '个人中心' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { notifications, remove } = useNotifyStore()
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`sidebar-bg flex-shrink-0 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0">C</div>
          {!sidebarCollapsed && <span className="text-white font-bold text-base tracking-wide">CRM 系统</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-2 border-t border-white/10" />
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          )}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/10 flex-shrink-0">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm"
          >
            <span>{sidebarCollapsed ? '→' : '←'}</span>
            {!sidebarCollapsed && <span>收起</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-gray-500 text-sm">客户关系管理系统 <span className="text-gray-300">v1.0</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {(user?.real_name || user?.username || 'U')[0].toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-700">{user?.real_name || user?.username}</div>
                  <div className="text-xs text-gray-400">{user?.role_name || '—'}</div>
                </div>
                <span className="text-gray-400 text-xs">▾</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-scale-in">
                  <button onClick={() => { navigate('/profile'); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <span>👤</span> 个人中心
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <span>🚪</span> 退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {notifications.map(n => (
          <div key={n.id} className={`animate-fade-in flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg min-w-64 max-w-sm border ${
            n.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            n.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <span className="text-base flex-shrink-0">
              {n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span className="text-sm flex-1">{n.message}</span>
            <button onClick={() => remove(n.id)} className="text-current opacity-50 hover:opacity-100 text-lg leading-none flex-shrink-0">×</button>
          </div>
        ))}
      </div>

      {/* Click outside to close menus */}
      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}
    </div>
  )
}
