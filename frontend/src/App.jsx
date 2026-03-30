import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Customers from './pages/Customers'
import Opportunities from './pages/Opportunities'
import Projects from './pages/Projects'
import Contracts from './pages/Contracts'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Transfer from './pages/Transfer'
import { UsersManagement, RolesManagement } from './pages/System'
import Profile from './pages/Profile'

function RequireAuth({ children }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="customers" element={<Customers />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="projects" element={<Projects />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="system/users" element={<UsersManagement />} />
          <Route path="system/roles" element={<RolesManagement />} />
          <Route path="system/transfer" element={<Transfer />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
