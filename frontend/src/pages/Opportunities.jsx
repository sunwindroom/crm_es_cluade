import { useState, useEffect, useCallback } from 'react'
import { oppsAPI, customersAPI, systemAPI } from '../api'
import { useNotifyStore, useAuthStore, ROLE_PERMS, hasRole } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField } from '../components/common'
import { Badge, fmt } from '../hooks'

const STAGES = [
  {value:'prospecting',label:'意向挖掘',prob:10,color:'bg-blue-400'},
  {value:'qualification',label:'需求确认',prob:30,color:'bg-purple-400'},
  {value:'proposal',label:'方案报价',prob:50,color:'bg-amber-400'},
  {value:'negotiation',label:'商务谈判',prob:70,color:'bg-orange-400'},
  {value:'closed_won',label:'赢单',prob:100,color:'bg-emerald-400'},
  {value:'closed_lost',label:'输单',prob:0,color:'bg-red-400'},
]
const INIT_FORM = {name:'',customer_id:'',customer_name:'',amount:'',stage:'prospecting',probability:10,expected_close_date:'',source:'',product:'',remark:'',owner_id:''}
const INIT_ACT = {content:'',activity_type:'note'}
const ACTIVITY_TYPES = [{value:'note',label:'备注'},{value:'call',label:'电话'},{value:'meeting',label:'会议'},{value:'email',label:'邮件'},{value:'visit',label:'拜访'}]

export default function Opportunities() {
  const [list,setList]=useState([]); const [total,setTotal]=useState(0); const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(false); const [perms,setPerms]=useState({})
  const [filters,setFilters]=useState({keyword:'',stage:'',status:'open'})
  const [modal,setModal]=useState({open:false,mode:'create',data:null})
  const [detailModal,setDetailModal]=useState({open:false,data:null,tab:'info'})
  const [form,setForm]=useState(INIT_FORM); const [saving,setSaving]=useState(false)
  const [delConfirm,setDelConfirm]=useState({open:false,id:null})
  const [customers,setCustomers]=useState([])
  const [allUsers,setAllUsers]=useState([])
  const [viewMode,setViewMode]=useState('list')
  const [actModal,setActModal]=useState({open:false,oppId:null})
  const [actForm,setActForm]=useState(INIT_ACT)
  const [assignModal,setAssignModal]=useState({open:false,id:null})
  const [assignUserId,setAssignUserId]=useState('')
  const [convertModal,setConvertModal]=useState({open:false,opp:null})
  const [convertForm,setConvertForm]=useState({manager_id:'',start_date:'',end_date:''})
  const notify=useNotifyStore(s=>s.notify)
  const user=useAuthStore(s=>s.user)
  const roleName=user?.role_name||''
  const canConvertToProject=hasRole(roleName,['系统管理员','总裁','营销副总裁','技术副总裁'])
  const PAGE_SIZE=10

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const res=await oppsAPI.list({page,pageSize:PAGE_SIZE,...filters})
      setList(res.data.list);setTotal(res.data.total)
      setPerms({canDelete:res.data.canDelete,canEdit:res.data.canEdit})
    }finally{setLoading(false)}
  },[page,filters])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    customersAPI.list({pageSize:200}).then(r=>setCustomers(r.data.list))
    systemAPI.listUsers({pageSize:200}).then(r=>setAllUsers(r.data.list))
  },[])

  const openCreate=()=>{setForm(INIT_FORM);setModal({open:true,mode:'create',data:null})}
  const openEdit=(row)=>{setForm({...row});setModal({open:true,mode:'edit',data:row})}
  const openDetail=async(row)=>{const res=await oppsAPI.get(row.id);setDetailModal({open:true,data:res.data,tab:'info'})}
  const refreshDetail=async(id)=>{const res=await oppsAPI.get(id);setDetailModal(d=>({...d,data:res.data}))}

  const handleSave=async()=>{
    if(!form.name)return notify('error','商机名称必填')
    setSaving(true)
    try{
      if(modal.mode==='create'){await oppsAPI.create(form);notify('success','商机创建成功')}
      else{await oppsAPI.update(modal.data.id,form);notify('success','商机更新成功')}
      setModal({...modal,open:false});load()
    }catch(e){notify('error',e?.message||'操作失败')}finally{setSaving(false)}
  }
  const handleDelete=async()=>{
    try{await oppsAPI.remove(delConfirm.id);notify('success','删除成功');setDelConfirm({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'删除失败')}
  }
  const handleAddActivity=async()=>{
    if(!actForm.content)return notify('error','跟进内容不能为空')
    try{
      await oppsAPI.addActivity(actModal.oppId,actForm)
      notify('success','跟进记录添加成功');setActModal({open:false,oppId:null});setActForm(INIT_ACT)
      if(detailModal.open)refreshDetail(detailModal.data.id)
    }catch(e){notify('error',e?.message||'失败')}
  }
  const handleAssign=async()=>{
    if(!assignUserId)return notify('error','请选择接收人')
    try{await oppsAPI.assign(assignModal.id,{assignee_id:assignUserId});notify('success','分配成功');setAssignModal({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'分配失败')}
  }
  const handleConvertToProject=async()=>{
    try{
      const res=await oppsAPI.convertToProject(convertModal.opp.id,convertForm)
      notify('success',`已成功转化为项目，项目编号：${res.data.project_no}`)
      setConvertModal({open:false,opp:null});load()
    }catch(e){notify('error',e?.message||'转化失败')}
  }

  const setFilter=(k,v)=>{setFilters(f=>({...f,[k]:v}));setPage(1)}
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const handleStageChange=(v)=>{const s=STAGES.find(x=>x.value===v);setForm(f=>({...f,stage:v,probability:s?.prob||f.probability}))}
  const d=detailModal.data

  const columns=[
    {key:'name',title:'商机名称',render:(v,r)=><button className="font-medium text-blue-600 hover:underline text-left" onClick={()=>openDetail(r)}>{v}</button>},
    {key:'customer_name',title:'客户'},
    {key:'amount',title:'金额',render:v=><span className="font-semibold text-gray-800">{fmt.yuan(v)}</span>,align:'right'},
    {key:'stage',title:'阶段',render:v=><Badge status={v}/>},
    {key:'probability',title:'赢率',render:v=>(
      <div className="flex items-center gap-2 w-24">
        <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width:`${v}%`}}/></div>
        <span className="text-xs text-gray-500">{v}%</span>
      </div>
    )},
    {key:'expected_close_date',title:'预计成交',render:v=>fmt.date(v)},
    {key:'owner_name',title:'负责人'},
    {key:'actions',title:'操作',width:'220px',render:(_,r)=>(
      <div className="flex items-center gap-1 flex-wrap">
        <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={()=>openEdit(r)}>编辑</button>
        <button className="btn btn-sm text-purple-600 hover:bg-purple-50 border-0 shadow-none" onClick={()=>{setActModal({open:true,oppId:r.id});setActForm(INIT_ACT)}}>跟进</button>
        <button className="btn btn-sm text-teal-600 hover:bg-teal-50 border-0 shadow-none" onClick={()=>{setAssignModal({open:true,id:r.id});setAssignUserId('')}}>分配</button>
        {canConvertToProject&&r.stage==='closed_won'&&!r.converted_project_id&&<button className="btn btn-sm text-emerald-600 hover:bg-emerald-50 border-0 shadow-none" onClick={()=>{setConvertModal({open:true,opp:r});setConvertForm({manager_id:'',start_date:'',end_date:''})}}>转项目</button>}
        {perms.canDelete&&<button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={()=>setDelConfirm({open:true,id:r.id})}>删除</button>}
      </div>
    )},
  ]

  const kanbanData=STAGES.slice(0,4).map(s=>({...s,items:list.filter(o=>o.stage===s.value)}))

  return (
    <div className="animate-fade-in">
      <PageHeader title="商机管理" desc="跟踪销售机会，推进商机阶段，提升赢单率"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button className={`px-3 py-1.5 text-sm ${viewMode==='list'?'bg-blue-600 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`} onClick={()=>setViewMode('list')}>列表</button>
              <button className={`px-3 py-1.5 text-sm ${viewMode==='kanban'?'bg-blue-600 text-white':'bg-white text-gray-600 hover:bg-gray-50'}`} onClick={()=>setViewMode('kanban')}>看板</button>
            </div>
            <button className="btn-primary" onClick={openCreate}>＋ 新建商机</button>
          </div>
        }/>
      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v=>setFilter('keyword',v)} placeholder="搜索商机名称、客户名称..." onSearch={load}/>
        <select className="form-select w-32" value={filters.stage} onChange={e=>setFilter('stage',e.target.value)}>
          <option value="">全部阶段</option>{STAGES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-select w-28" value={filters.status} onChange={e=>setFilter('status',e.target.value)}>
          <option value="">全部</option><option value="open">进行中</option>
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={()=>{setFilters({keyword:'',stage:'',status:'open'});setPage(1)}}>重置</button>
      </div>

      {viewMode==='list'?(
        <div className="card"><Table columns={columns} data={list} loading={loading}/><div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage}/></div></div>
      ):(
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanData.map(col=>(
            <div key={col.value} className="flex-shrink-0 w-72">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl text-white text-sm font-medium ${col.color}`}>
                <span>{col.label}</span><span className="ml-auto bg-white/30 rounded-full px-2 py-0.5 text-xs">{col.items.length}</span>
              </div>
              <div className="bg-gray-100 rounded-b-xl p-2 space-y-2 min-h-48">
                {col.items.map(item=>(
                  <div key={item.id} className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={()=>openEdit(item)}>
                    <div className="font-medium text-sm text-gray-800 mb-1">{item.name}</div>
                    <div className="text-xs text-gray-500 mb-2">{item.customer_name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-600">{fmt.yuan(item.amount)}</span>
                      <span className="text-xs text-gray-400">{item.probability}%</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">{item.owner_name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={modal.open} onClose={()=>setModal({...modal,open:false})} title={modal.mode==='create'?'新建商机':'编辑商机'} width="max-w-2xl"
        footer={<><button className="btn-secondary" onClick={()=>setModal({...modal,open:false})}>取消</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'保存中...':'保存'}</button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormField label="商机名称" required><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="请输入商机名称"/></FormField></div>
          <FormField label="关联客户"><select className="form-select" value={form.customer_id} onChange={e=>{const c=customers.find(x=>x.id==e.target.value);setForm(f=>({...f,customer_id:e.target.value,customer_name:c?.name||''}))}}>
            <option value="">请选择客户</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></FormField>
          <FormField label="商机金额（元）"><input type="number" className="form-input" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00"/></FormField>
          <FormField label="商机阶段"><select className="form-select" value={form.stage} onChange={e=>handleStageChange(e.target.value)}>{STAGES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></FormField>
          <FormField label="赢率(%)"><input type="number" min="0" max="100" className="form-input" value={form.probability} onChange={e=>set('probability',e.target.value)}/></FormField>
          <FormField label="预计成交日期"><input type="date" className="form-input" value={form.expected_close_date} onChange={e=>set('expected_close_date',e.target.value)}/></FormField>
          <FormField label="产品/服务"><input className="form-input" value={form.product} onChange={e=>set('product',e.target.value)} placeholder="相关产品或服务"/></FormField>
          {hasRole(roleName,ROLE_PERMS.CAN_EDIT_ANY)&&<FormField label="负责人"><select className="form-select" value={form.owner_id||''} onChange={e=>set('owner_id',e.target.value)}><option value="">当前用户</option>{allUsers.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}</select></FormField>}
          <div className="col-span-2"><FormField label="备注"><textarea className="form-textarea" rows={3} value={form.remark} onChange={e=>set('remark',e.target.value)} placeholder="备注..."/></FormField></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {d&&<Modal open={detailModal.open} onClose={()=>setDetailModal({open:false,data:null,tab:'info'})}
        title={<span className="flex items-center gap-2">{d.name} <Badge status={d.stage}/></span>} width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={()=>setDetailModal({...detailModal,open:false})}>关闭</button><button className="btn-primary" onClick={()=>{setActModal({open:true,oppId:d.id});setActForm(INIT_ACT)}}>+ 跟进记录</button></>}>
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          {[{key:'info',label:'商机信息'},{key:'activities',label:`跟进记录(${d.activities?.length||0})`}].map(t=>(
            <button key={t.key} className={`tab-item ${detailModal.tab===t.key?'tab-item-active':'tab-item-inactive'}`} onClick={()=>setDetailModal(x=>({...x,tab:t.key}))}>{t.label}</button>
          ))}
        </div>
        {detailModal.tab==='info'&&<div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[['商机名称',d.name],['客户',d.customer_name],['金额',fmt.yuan(d.amount)],['阶段',<Badge status={d.stage}/>],['赢率',`${d.probability}%`],['预计成交',fmt.date(d.expected_close_date)],['产品服务',d.product],['负责人',d.owner_name]].map(([l,v])=>(
            <div key={l} className="flex gap-2"><span className="text-gray-400 w-20 flex-shrink-0">{l}</span><span className="text-gray-700">{v||'—'}</span></div>
          ))}
          {d.remark&&<div className="col-span-2 flex gap-2"><span className="text-gray-400 w-20 flex-shrink-0">备注</span><span className="text-gray-600">{d.remark}</span></div>}
          {d.converted_project_id&&<div className="col-span-2 mt-2 p-2 bg-green-50 rounded text-green-700 text-xs">✅ 已转化为项目（项目ID: {d.converted_project_id}）</div>}
        </div>}
        {detailModal.tab==='activities'&&<div className="space-y-3 max-h-80 overflow-y-auto">
          {!d.activities?.length&&<div className="text-center py-8 text-gray-400">暂无跟进记录</div>}
          {d.activities?.map(a=>(
            <div key={a.id} className="flex gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="w-1.5 bg-purple-300 rounded-full flex-shrink-0"/>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-purple text-xs">{ACTIVITY_TYPES.find(t=>t.value===a.activity_type)?.label||a.activity_type}</span>
                  <span className="text-xs text-gray-400">{fmt.datetime(a.created_at)} · {a.creator_name}</span>
                </div>
                <p className="text-sm text-gray-700">{a.content}</p>
              </div>
            </div>
          ))}
        </div>}
      </Modal>}

      {/* Activity Modal */}
      <Modal open={actModal.open} onClose={()=>setActModal({open:false,oppId:null})} title="添加跟进记录" width="max-w-lg"
        footer={<><button className="btn-secondary" onClick={()=>setActModal({open:false,oppId:null})}>取消</button><button className="btn-primary" onClick={handleAddActivity}>保存</button></>}>
        <div className="space-y-4">
          <FormField label="跟进类型"><select className="form-select" value={actForm.activity_type} onChange={e=>setActForm(f=>({...f,activity_type:e.target.value}))}>{ACTIVITY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></FormField>
          <FormField label="跟进内容" required><textarea className="form-textarea" rows={4} value={actForm.content} onChange={e=>setActForm(f=>({...f,content:e.target.value}))} placeholder="描述本次跟进情况..."/></FormField>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal open={assignModal.open} onClose={()=>setAssignModal({open:false,id:null})} title="分配商机" width="max-w-sm"
        footer={<><button className="btn-secondary" onClick={()=>setAssignModal({open:false,id:null})}>取消</button><button className="btn-primary" onClick={handleAssign}>确认分配</button></>}>
        <FormField label="接收人" required>
          <select className="form-select" value={assignUserId} onChange={e=>setAssignUserId(e.target.value)}>
            <option value="">请选择接收人</option>{allUsers.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username} ({u.department||'—'})</option>)}
          </select>
        </FormField>
      </Modal>

      {/* Convert to Project Modal */}
      <Modal open={convertModal.open} onClose={()=>setConvertModal({open:false,opp:null})} title={`赢单转项目 — ${convertModal.opp?.name}`} width="max-w-md"
        footer={<><button className="btn-secondary" onClick={()=>setConvertModal({open:false,opp:null})}>取消</button><button className="btn-success" onClick={handleConvertToProject}>确认转化</button></>}>
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">将基于此赢单商机创建新项目，客户、金额等信息将自动带入。</div>
          <FormField label="项目经理"><select className="form-select" value={convertForm.manager_id} onChange={e=>setConvertForm(f=>({...f,manager_id:e.target.value}))}><option value="">请选择</option>{allUsers.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}</select></FormField>
          <FormField label="计划开始日期"><input type="date" className="form-input" value={convertForm.start_date} onChange={e=>setConvertForm(f=>({...f,start_date:e.target.value}))}/></FormField>
          <FormField label="计划结束日期"><input type="date" className="form-input" value={convertForm.end_date} onChange={e=>setConvertForm(f=>({...f,end_date:e.target.value}))}/></FormField>
        </div>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={()=>setDelConfirm({open:false,id:null})} onConfirm={handleDelete} title="删除商机" message="确定要删除此商机吗？"/>
    </div>
  )
}
