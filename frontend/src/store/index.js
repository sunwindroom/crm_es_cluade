import { create } from 'zustand'

export const ROLE_PERMS = {
  CAN_VIEW_ALL: ['系统管理员','总裁','营销副总裁','技术副总裁','财务','商务'],
  CAN_DELETE: ['系统管理员'],
  CAN_EDIT_ANY: ['系统管理员','总裁','营销副总裁'],
  CAN_CONVERT_LEAD: ['系统管理员','总裁','营销副总裁'],
  CAN_CREATE_PROJECT: ['系统管理员','总裁','技术副总裁','营销副总裁','商务'],
  CAN_ASSIGN_PM: ['系统管理员','技术副总裁'],
  CAN_VIEW_ALL_PROJECTS: ['系统管理员','总裁','技术副总裁','营销副总裁','商务','财务'],
  CAN_CREATE_CONTRACT: ['系统管理员','总裁','技术副总裁','营销副总裁','商务'],
  CAN_CONFIRM_PAYMENT: ['系统管理员','财务'],
  CAN_TRANSFER: ['系统管理员','总裁','营销副总裁','技术副总裁'],
}

export const hasRole = (userRoleName, roles) => roles.includes(userRoleName)

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('crm_user') || 'null'),
  token: localStorage.getItem('crm_token') || null,
  setAuth: (user, token) => { localStorage.setItem('crm_user', JSON.stringify(user)); localStorage.setItem('crm_token', token); set({ user, token }) },
  logout: () => { localStorage.removeItem('crm_user'); localStorage.removeItem('crm_token'); set({ user: null, token: null }) },
  updateUser: (user) => { localStorage.setItem('crm_user', JSON.stringify(user)); set({ user }) },
}))

export const useNotifyStore = create((set) => ({
  notifications: [],
  notify: (type, message) => {
    const id = Date.now()
    set(state => ({ notifications: [...state.notifications, { id, type, message }] }))
    setTimeout(() => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })), 3500)
  },
  remove: (id) => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
}))

export const useAppStore = create((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
