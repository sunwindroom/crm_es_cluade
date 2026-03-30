import { useState, useEffect } from 'react'
import { systemAPI } from '../api'
import { useNotifyStore, useAuthStore, ROLE_PERMS, hasRole } from '../store'
import { Modal, ConfirmDialog, PageHeader, FormField, Table } from '../components/common'
import { fmt } from '../hooks'

export default function Transfer() {
  const [resignedUsers, setResignedUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [transferModal, setTransferModal] = useState({ open: false, user: null })
  const [receiverId, setReceiverId] = useState('')
  const [transferTypes, setTransferTypes] = useState(['leads','customers','opportunities','projects','contracts'])
  const [notes, setNotes] = useState('')
  const [resignConfirm, setResignConfirm] = useState({ open: false, id: null, name: '' })
  const [tab, setTab] = useState('active')
  const notify = useNotifyStore(s => s.notify)
  const user = useAuthStore(s => s.user)
  const roleName = user?.role_name || ''

  const canOperate = hasRole(roleName, ROLE_PERMS.CAN_TRANSFER)

  const load = async () => {
    setLoading(true)
    try {
      const [usersRes, resignedRes, logsRes] = await Promise.all([
        systemAPI.listUsers({ pageSize: 200, status: 1 }),
        systemAPI.getResignedUsers(),
        systemAPI.getTransferLogs()
      ])
      setAllUsers(usersRes.data.list)
      setResignedUsers(resignedRes.data)
      setLogs(logsRes.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleResign = async () => {
    try {
      await systemAPI.resignUser(resignConfirm.id)
      notify('success', `已将 ${resignConfirm.name} 标记为离职`)
      setResignConfirm({ open: false, id: null, name: '' })
      load()
    } catch (e) { notify('error', e?.message || '操作失败') }
  }

  const handleTransfer = async () => {
    if (!receiverId) return notify('error', '请选择接收人')
    if (!transferTypes.length) return notify('error', '请选择至少一种移交类型')
    try {
      const res = await systemAPI.transferUser(transferModal.user.id, {
        receiver_id: receiverId, transfer_types: transferTypes, notes
      })
      notify('success', res.message || '移交成功')
      setTransferModal({ open: false, user: null })
      setReceiverId(''); setNotes('')
      load()
    } catch (e) { notify('error', e?.message || '移交失败') }
  }

  const toggleType = (type) => {
    setTransferTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const TYPES = [
    { value: 'leads', label: '线索' },
    { value: 'customers', label: '客户' },
    { value: 'opportunities', label: '商机' },
    { value: 'projects', label: '项目' },
    { value: 'contracts', label: '合同' },
  ]

  const logColumns = [
    { key: 'resigned_name', title: '离职人员' },
    { key: 'receiver_name', title: '接收人' },
    { key: 'operator_name', title: '操作人' },
    { key: 'transfer_type', title: '移交类型', render: v => <span className="text-xs text-gray-600">{v}</span> },
    { key: 'record_count', title: '移交记录数', render: v => <span className="font-semibold text-blue-600">{v}</span> },
    { key: 'notes', title: '备注', render: v => v || '—' },
    { key: 'created_at', title: '操作时间', render: v => fmt.datetime(v) },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="离职移交" desc="处理离职人员的数据移交，确保业务连续性" />

      {!canOperate && (
        <div className="card p-6 text-center text-gray-500">
          <div className="text-4xl mb-2">🔒</div>
          <div>您没有权限进行离职移交操作，需要总裁、营销副总裁、技术副总裁或系统管理员权限</div>
        </div>
      )}

      {canOperate && (
        <>
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[{key:'active',label:'在职员工'},{key:'resigned',label:'离职员工'},{key:'logs',label:'移交记录'}].map(t=>(
              <button key={t.key} className={`tab-item ${tab===t.key?'tab-item-active':'tab-item-inactive'}`} onClick={()=>setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {tab === 'active' && (
            <div className="card">
              <div className="card-header"><span className="font-semibold text-gray-700">在职员工列表</span></div>
              <div className="card-body">
                {loading ? <div className="text-center py-8 text-gray-400">加载中...</div> :
                <div className="grid grid-cols-1 gap-2">
                  {allUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium flex-shrink-0">
                        {(u.real_name||u.username)[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{u.real_name || u.username}</div>
                        <div className="text-xs text-gray-400">{u.role_name} · {u.department || '—'} · {u.position || '—'}</div>
                      </div>
                      <button className="btn-danger btn-sm" onClick={() => setResignConfirm({ open: true, id: u.id, name: u.real_name || u.username })}>
                        标记离职
                      </button>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          )}

          {tab === 'resigned' && (
            <div className="card">
              <div className="card-header"><span className="font-semibold text-gray-700">离职员工列表</span></div>
              <div className="card-body">
                {!resignedUsers.length ? <div className="text-center py-8 text-gray-400">暂无离职员工记录</div> :
                <div className="grid grid-cols-1 gap-2">
                  {resignedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-4 p-3 border border-red-100 rounded-lg bg-red-50/30">
                      <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-medium flex-shrink-0">
                        {(u.real_name||u.username)[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-700">{u.real_name || u.username}</div>
                        <div className="text-xs text-gray-400">{u.role_name} · {u.department||'—'} · 离职时间：{fmt.date(u.resigned_at)}</div>
                      </div>
                      <button className="btn-primary btn-sm" onClick={() => { setTransferModal({ open: true, user: u }); setReceiverId(''); setTransferTypes(['leads','customers','opportunities','projects','contracts']); setNotes('') }}>
                        发起移交
                      </button>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          )}

          {tab === 'logs' && (
            <div className="card">
              <div className="card-header"><span className="font-semibold text-gray-700">移交记录</span></div>
              <Table columns={logColumns} data={logs} loading={loading} />
            </div>
          )}
        </>
      )}

      {/* Transfer Modal */}
      <Modal open={transferModal.open} onClose={() => setTransferModal({ open: false, user: null })}
        title={`发起离职移交 — ${transferModal.user?.real_name || transferModal.user?.username}`} width="max-w-lg"
        footer={<>
          <button className="btn-secondary" onClick={() => setTransferModal({ open: false, user: null })}>取消</button>
          <button className="btn-primary" onClick={handleTransfer}>确认移交</button>
        </>}>
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            ⚠️ 移交后，接收人将获得离职人员的所有选中类型数据的访问权限
          </div>
          <FormField label="接收人" required>
            <select className="form-select" value={receiverId} onChange={e => setReceiverId(e.target.value)}>
              <option value="">请选择接收人</option>
              {allUsers.filter(u => u.id !== transferModal.user?.id).map(u => (
                <option key={u.id} value={u.id}>{u.real_name || u.username} ({u.role_name} - {u.department||'—'})</option>
              ))}
            </select>
          </FormField>
          <FormField label="移交数据类型">
            <div className="flex flex-wrap gap-2 mt-1">
              {TYPES.map(t => (
                <label key={t.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${transferTypes.includes(t.value) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input type="checkbox" className="hidden" checked={transferTypes.includes(t.value)} onChange={() => toggleType(t.value)} />
                  {transferTypes.includes(t.value) ? '✓ ' : ''}{t.label}
                </label>
              ))}
            </div>
          </FormField>
          <FormField label="备注">
            <textarea className="form-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="移交说明..."/>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog open={resignConfirm.open} onClose={() => setResignConfirm({ open: false, id: null, name: '' })}
        onConfirm={handleResign} title="确认离职" message={`确定将 "${resignConfirm.name}" 标记为离职吗？该操作将禁用其账号。`} />
    </div>
  )
}
