import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('crm_user') || 'null'),
  token: localStorage.getItem('crm_token') || null,
  setAuth: (user, token) => {
    localStorage.setItem('crm_user', JSON.stringify(user))
    localStorage.setItem('crm_token', token)
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('crm_user')
    localStorage.removeItem('crm_token')
    set({ user: null, token: null })
  },
  updateUser: (user) => {
    localStorage.setItem('crm_user', JSON.stringify(user))
    set({ user })
  },
}))

export const useNotifyStore = create((set) => ({
  notifications: [],
  notify: (type, message) => {
    const id = Date.now()
    set(state => ({ notifications: [...state.notifications, { id, type, message }] }))
    setTimeout(() => {
      set(state => ({ notifications: state.notifications.filter(n => n.id !== id) }))
    }, 3500)
  },
  remove: (id) => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
}))

export const useAppStore = create((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
