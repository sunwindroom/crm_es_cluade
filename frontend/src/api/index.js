import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const request = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

request.interceptors.request.use(config => {
  const token = localStorage.getItem('crm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('crm_token')
      localStorage.removeItem('crm_user')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || { message: '网络请求失败' })
  }
)

export default request

// Auth
export const authAPI = {
  login: (data) => request.post('/auth/login', data),
  getProfile: () => request.get('/auth/profile'),
  updateProfile: (data) => request.put('/auth/profile', data),
  changePassword: (data) => request.put('/auth/password', data),
}

// Leads
export const leadsAPI = {
  list: (params) => request.get('/leads', { params }),
  get: (id) => request.get(`/leads/${id}`),
  create: (data) => request.post('/leads', data),
  update: (id, data) => request.put(`/leads/${id}`, data),
  remove: (id) => request.delete(`/leads/${id}`),
  convert: (id) => request.post(`/leads/${id}/convert`),
}

// Customers
export const customersAPI = {
  list: (params) => request.get('/customers', { params }),
  get: (id) => request.get(`/customers/${id}`),
  create: (data) => request.post('/customers', data),
  update: (id, data) => request.put(`/customers/${id}`, data),
  remove: (id) => request.delete(`/customers/${id}`),
  addContact: (id, data) => request.post(`/customers/${id}/contacts`, data),
  addFollowup: (id, data) => request.post(`/customers/${id}/followups`, data),
}

// Opportunities
export const oppsAPI = {
  list: (params) => request.get('/opportunities', { params }),
  get: (id) => request.get(`/opportunities/${id}`),
  create: (data) => request.post('/opportunities', data),
  update: (id, data) => request.put(`/opportunities/${id}`, data),
  remove: (id) => request.delete(`/opportunities/${id}`),
  addActivity: (id, data) => request.post(`/opportunities/${id}/activities`, data),
  funnel: () => request.get('/opportunities/funnel'),
}

// Projects
export const projectsAPI = {
  list: (params) => request.get('/projects', { params }),
  get: (id) => request.get(`/projects/${id}`),
  create: (data) => request.post('/projects', data),
  update: (id, data) => request.put(`/projects/${id}`, data),
  remove: (id) => request.delete(`/projects/${id}`),
  createTask: (id, data) => request.post(`/projects/${id}/tasks`, data),
  updateTask: (id, taskId, data) => request.put(`/projects/${id}/tasks/${taskId}`, data),
  deleteTask: (id, taskId) => request.delete(`/projects/${id}/tasks/${taskId}`),
}

// Contracts
export const contractsAPI = {
  list: (params) => request.get('/contracts', { params }),
  get: (id) => request.get(`/contracts/${id}`),
  create: (data) => request.post('/contracts', data),
  update: (id, data) => request.put(`/contracts/${id}`, data),
  remove: (id) => request.delete(`/contracts/${id}`),
  approve: (id, data) => request.put(`/contracts/${id}/approve`, data),
  savePlans: (id, data) => request.post(`/contracts/${id}/payment-plans`, data),
}

// Payments
export const paymentsAPI = {
  list: (params) => request.get('/payments', { params }),
  get: (id) => request.get(`/payments/${id}`),
  create: (data) => request.post('/payments', data),
  update: (id, data) => request.put(`/payments/${id}`, data),
  remove: (id) => request.delete(`/payments/${id}`),
  confirm: (id) => request.put(`/payments/${id}/confirm`),
}

// Reports
export const reportsAPI = {
  dashboard: () => request.get('/reports/dashboard'),
  paymentTrend: () => request.get('/reports/payment-trend'),
  salesFunnel: () => request.get('/reports/sales-funnel'),
  customerSource: () => request.get('/reports/customer-source'),
  customerIndustry: () => request.get('/reports/customer-industry'),
  leadSource: () => request.get('/reports/lead-source'),
  opportunityStage: () => request.get('/reports/opportunity-stage'),
  staffPerformance: () => request.get('/reports/staff-performance'),
  monthlyCustomers: () => request.get('/reports/monthly-customers'),
}

// System
export const systemAPI = {
  listUsers: (params) => request.get('/system/users', { params }),
  getUser: (id) => request.get(`/system/users/${id}`),
  createUser: (data) => request.post('/system/users', data),
  updateUser: (id, data) => request.put(`/system/users/${id}`, data),
  deleteUser: (id) => request.delete(`/system/users/${id}`),
  resetPassword: (id, data) => request.put(`/system/users/${id}/reset-password`, data),
  listRoles: () => request.get('/system/roles'),
  createRole: (data) => request.post('/system/roles', data),
  updateRole: (id, data) => request.put(`/system/roles/${id}`, data),
  deleteRole: (id) => request.delete(`/system/roles/${id}`),
  listLogs: (params) => request.get('/system/logs', { params }),
}
