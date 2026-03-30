import { useState, useEffect, useCallback } from 'react'
import { projectsAPI, customersAPI, systemAPI, oppsAPI } from '../api'
import { useNotifyStore, useAuthStore, ROLE_PERMS, hasRole } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, ProgressBar, Tabs } from '../components/common'
import { Badge, fmt } from '../hooks'

const STATUS_OPTS = [{value:'planning',label:'规划中'},{value:'in_progress',label:'进行中'},{value:'completed',label:'已完成'},{value:'suspended',label:'已暂停'},{value:'cancelled',label:'已取消'}]
const PRIORITY_OPTS = [{value:'low',label:'低'},{value:'normal',label:'普通'},{value:'high',label:'高'},{value:'urgent',label:'紧急'}]
const TASK_STATUS = [{value:'todo',label:'待处理'},{value:'in_progress',label:'进行中'},{value:'completed',label:'已完成'},{value:'cancelled',label:'已取消'}]
const MS_STATUS = [{value:'pending',label:'待完成'},{value:'completed',label:'已完成'},{value:'delayed',label:'已延期'}]
const INIT_FORM = {name:'',customer_id:'',customer_name:'',opportunity_id:'',manager_id:'',sales_id:'',start_date:'',end_date:'',budget:'',status:'planning',priority:'normal',description:''}
const INIT_TASK = {name:'',assignee_id:'',start_date:'',due_date:'',status:'todo',priority:'normal',progress:0,description:''}
const INIT_MS = {name:'',planned_date:'',description:''}
const INIT_WH = {week_start:'',hours:'',content:'',hourly_rate:''}

export default function Projects() {
  const [list,setList]=useState([]); const [total,setTotal]=useState(0); const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(false); const [canCreate,setCanCreate]=useState(false); const [canAssignPM,setCanAssignPM]=useState(false)
  const [filters,setFilters]=useState({keyword:'',status:''})
  const [modal,setModal]=useState({open:false,mode:'create',data:null})
  const [detailModal,setDetailModal]=useState({open:false,data:null,tab:'info'})
  const [form,setForm]=useState(INIT_FORM); const [saving,setSaving]=useState(false)
  const [delConfirm,setDelConfirm]=useState({open:false,id:null})
  const [customers,setCustomers]=useState([]); const [users,setUsers]=useState([]); const [opps,setOpps]=useState([])
  const [taskModal,setTaskModal]=useState({open:false,projectId:null,mode:'create',data:null})
  const [taskForm,setTaskForm]=useState(INIT_TASK)
  const [msModal,setMsModal]=useState({open:false,projectId:null,mode:'create',data:null})
  const [msForm,setMsForm]=useState(INIT_MS)
  const [whModal,setWhModal]=useState({open:false,projectId:null})
  const [whForm,setWhForm]=useState(INIT_WH)
  const [assignPMModal,setAssignPMModal]=useState({open:false,id:null})
  const [assignPMUserId,setAssignPMUserId]=useState('')
  const notify=useNotifyStore(s=>s.notify)
  const user=useAuthStore(s=>s.user)
  const roleName=user?.role_name||''
  const PAGE_SIZE=10

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const res=await projectsAPI.list({page,pageSize:PAGE_SIZE,...filters})
      setList(res.data.list);setTotal(res.data.total);setCanCreate(res.data.canCreate);setCanAssignPM(res.data.canAssignPM)
    }finally{setLoading(false)}
  },[page,filters])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    customersAPI.list({pageSize:200}).then(r=>setCustomers(r.data.list))
    systemAPI.listUsers({pageSize:200}).then(r=>setUsers(r.data.list))
    oppsAPI.list({pageSize:200,stage:'closed_won'}).then(r=>setOpps(r.data.list))
  },[])

  const openCreate=()=>{setForm(INIT_FORM);setModal({open:true,mode:'create',data:null})}
  const openEdit=(row)=>{setForm({...row});setModal({open:true,mode:'edit',data:row})}
  const openDetail=async(row)=>{const res=await projectsAPI.get(row.id);setDetailModal({open:true,data:res.data,tab:'info'})}
  const refreshDetail=async(id)=>{const res=await projectsAPI.get(id);setDetailModal(d=>({...d,data:res.data}))}

  const handleSave=async()=>{
    if(!form.name)return notify('error','项目名称必填')
    setSaving(true)
    try{
      if(modal.mode==='create'){await projectsAPI.create(form);notify('success','项目创建成功')}
      else{await projectsAPI.update(modal.data.id,form);notify('success','项目更新成功')}
      setModal({...modal,open:false});load()
    }catch(e){notify('error',e?.message||'操作失败')}finally{setSaving(false)}
  }
  const handleDelete=async()=>{
    try{await projectsAPI.remove(delConfirm.id);notify('success','删除成功');setDelConfirm({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'删除失败')}
  }
  const handleTaskSave=async()=>{
    if(!taskForm.name)return notify('error','任务名称必填')
    try{
      if(taskModal.mode==='create')await projectsAPI.createTask(taskModal.projectId,taskForm)
      else await projectsAPI.updateTask(taskModal.projectId,taskModal.data.id,taskForm)
      notify('success','保存成功');setTaskModal({...taskModal,open:false});refreshDetail(taskModal.projectId)
    }catch(e){notify('error',e?.message||'操作失败')}
  }
  const handleDeleteTask=async(projectId,taskId)=>{
    try{await projectsAPI.deleteTask(projectId,taskId);notify('success','任务已删除');refreshDetail(projectId)}
    catch(e){notify('error',e?.message||'失败')}
  }
  const handleMsSave=async()=>{
    if(!msForm.name)return notify('error','里程碑名称必填')
    try{
      if(msModal.mode==='create')await projectsAPI.createMilestone(msModal.projectId,msForm)
      else await projectsAPI.updateMilestone(msModal.projectId,msModal.data.id,msForm)
      notify('success','保存成功');setMsModal({...msModal,open:false});refreshDetail(msModal.projectId)
    }catch(e){notify('error',e?.message||'失败')}
  }
  const handleWhSave=async()=>{
    if(!whForm.week_start||!whForm.hours)return notify('error','请填写周开始日期和工时')
    try{await projectsAPI.addWorkhours(whModal.projectId,whForm);notify('success','工时记录成功');setWhModal({open:false,projectId:null});setWhForm(INIT_WH);refreshDetail(whModal.projectId)}
    catch(e){notify('error',e?.message||'失败')}
  }
  const handleAssignPM=async()=>{
    if(!assignPMUserId)return notify('error','请选择项目经理')
    try{await projectsAPI.assignManager(assignPMModal.id,{manager_id:assignPMUserId});notify('success','指派成功');setAssignPMModal({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'失败')}
  }

  const setFilter=(k,v)=>{setFilters(f=>({...f,[k]:v}));setPage(1)}
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))

  const getProgressColor=(p)=>p>=80?'bg-emerald-500':p>=50?'bg-blue-500':p>=30?'bg-amber-500':'bg-gray-400'

  const columns=[
    {key:'project_no',title:'项目编号',render:v=><span className="font-mono text-xs text-gray-500">{v}</span>},
    {key:'name',title:'项目名称',render:(v,r)=><button className="font-medium text-blue-600 hover:underline text-left" onClick={()=>openDetail(r)}>{v}</button>},
    {key:'customer_name',title:'客户'},
    {key:'status',title:'状态',render:v=><Badge status={v}/>},
    {key:'priority',title:'优先级',render:v=><Badge status={v}/>},
    {key:'progress',title:'进度',render:v=><div className="w-28"><ProgressBar value={v} color={getProgressColor(v)}/></div>},
    {key:'end_date',title:'截止日期',render:(v,r)=>{const o=v&&new Date(v)<new Date()&&r.status!=='completed';return <span className={o?'text-red-500 font-medium':''}>{fmt.date(v)}</span>}},
    {key:'manager_name',title:'项目经理'},
    {key:'actions',title:'操作',width:'140px',render:(_,r)=>(
      <div className="flex items-center gap-1">
        <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={()=>openEdit(r)}>编辑</button>
        {canAssignPM&&<button className="btn btn-sm text-purple-600 hover:bg-purple-50 border-0 shadow-none" onClick={()=>{setAssignPMModal({open:true,id:r.id});setAssignPMUserId(r.manager_id||'')}}>指派PM</button>}
        <button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={()=>setDelConfirm({open:true,id:r.id})}>删除</button>
      </div>
    )},
  ]

  const d=detailModal.data

  // Gantt chart data
  const renderGantt=(tasks)=>{
    if(!tasks||!tasks.length)return <div className="text-center py-8 text-gray-400">暂无任务数据</div>
    const allDates=tasks.flatMap(t=>[t.start_date,t.due_date]).filter(Boolean).sort()
    if(!allDates.length)return <div className="text-center py-8 text-gray-400">任务未设置日期</div>
    const minDate=new Date(allDates[0])
    const maxDate=new Date(allDates[allDates.length-1])
    const totalDays=Math.max(1,Math.ceil((maxDate-minDate)/(1000*60*60*24)))+1
    const statusColors={todo:'bg-gray-300',in_progress:'bg-blue-400',completed:'bg-emerald-400',cancelled:'bg-red-300'}
    return (
      <div className="overflow-x-auto">
        <div style={{minWidth:600}}>
          <div className="flex items-center mb-1 text-xs text-gray-400 pl-32">
            <span>{fmt.date(minDate.toISOString())}</span>
            <span className="ml-auto">{fmt.date(maxDate.toISOString())}</span>
          </div>
          {tasks.map(t=>{
            const s=t.start_date?new Date(t.start_date):minDate
            const e=t.due_date?new Date(t.due_date):maxDate
            const left=Math.max(0,Math.ceil((s-minDate)/(1000*60*60*24)))
            const width=Math.max(1,Math.ceil((e-s)/(1000*60*60*24))+1)
            const leftPct=(left/totalDays)*100
            const widthPct=(width/totalDays)*100
            return (
              <div key={t.id} className="flex items-center gap-2 mb-1">
                <div className="w-32 text-xs text-gray-600 truncate flex-shrink-0">{t.name}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded relative">
                  <div className={`h-full rounded ${statusColors[t.status]||'bg-blue-300'} flex items-center px-1 text-white text-xs absolute`}
                    style={{left:`${leftPct}%`,width:`${Math.max(widthPct,2)}%`,minWidth:4}}>
                    {widthPct>10&&`${t.progress||0}%`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="项目管理" desc="管理项目全生命周期，跟踪进度、里程碑和工时"
        actions={canCreate&&<button className="btn-primary" onClick={openCreate}>＋ 新建项目</button>}/>
      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v=>setFilter('keyword',v)} placeholder="搜索项目名称、编号、客户..." onSearch={load}/>
        <select className="form-select w-32" value={filters.status} onChange={e=>setFilter('status',e.target.value)}>
          <option value="">全部状态</option>{STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={()=>{setFilters({keyword:'',status:''});setPage(1)}}>重置</button>
      </div>
      <div className="card"><Table columns={columns} data={list} loading={loading}/><div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage}/></div></div>

      {/* Form Modal */}
      <Modal open={modal.open} onClose={()=>setModal({...modal,open:false})} title={modal.mode==='create'?'新建项目':'编辑项目'} width="max-w-2xl"
        footer={<><button className="btn-secondary" onClick={()=>setModal({...modal,open:false})}>取消</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'保存中...':'保存'}</button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><FormField label="项目名称" required><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="请输入项目名称"/></FormField></div>
          <FormField label="关联客户"><select className="form-select" value={form.customer_id} onChange={e=>{const c=customers.find(x=>x.id==e.target.value);setForm(f=>({...f,customer_id:e.target.value,customer_name:c?.name||''}))}}>
            <option value="">请选择</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></FormField>
          <FormField label="关联赢单商机"><select className="form-select" value={form.opportunity_id||''} onChange={e=>set('opportunity_id',e.target.value)}>
            <option value="">不关联</option>{opps.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
          </select></FormField>
          <FormField label="项目经理">{canAssignPM?
            <select className="form-select" value={form.manager_id} onChange={e=>set('manager_id',e.target.value)}><option value="">请选择</option>{users.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}</select>:
            <input className="form-input bg-gray-50" value={users.find(u=>u.id==form.manager_id)?.real_name||'待指派'} disabled/>}
          </FormField>
          <FormField label="销售协调"><select className="form-select" value={form.sales_id||''} onChange={e=>set('sales_id',e.target.value)}>
            <option value="">无</option>{users.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}
          </select></FormField>
          <FormField label="开始日期"><input type="date" className="form-input" value={form.start_date} onChange={e=>set('start_date',e.target.value)}/></FormField>
          <FormField label="计划结束日期"><input type="date" className="form-input" value={form.end_date} onChange={e=>set('end_date',e.target.value)}/></FormField>
          <FormField label="预算（元）"><input type="number" className="form-input" value={form.budget} onChange={e=>set('budget',e.target.value)} placeholder="0.00"/></FormField>
          <FormField label="优先级"><select className="form-select" value={form.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITY_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
          <FormField label="状态"><select className="form-select" value={form.status} onChange={e=>set('status',e.target.value)}>{STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
          {modal.mode==='edit'&&<FormField label="进度(%)"><input type="number" min="0" max="100" className="form-input" value={form.progress||0} onChange={e=>set('progress',e.target.value)}/></FormField>}
          <div className="col-span-2"><FormField label="项目描述"><textarea className="form-textarea" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="项目背景和目标..."/></FormField></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {d&&<Modal open={detailModal.open} onClose={()=>setDetailModal({open:false,data:null,tab:'info'})}
        title={<div className="flex items-center gap-2">{d.name} <Badge status={d.status}/> <Badge status={d.priority}/></div>} width="max-w-5xl"
        footer={<><button className="btn-secondary" onClick={()=>setDetailModal({...detailModal,open:false})}>关闭</button><button className="btn-primary" onClick={()=>{setDetailModal({...detailModal,open:false});openEdit(d)}}>编辑项目</button></>}>
        <Tabs active={detailModal.tab} onChange={t=>setDetailModal(x=>({...x,tab:t}))} items={[
          {key:'info',label:'项目信息'},{key:'tasks',label:`任务(${d.tasks?.length||0})`},
          {key:'milestones',label:`里程碑(${d.milestones?.length||0})`},{key:'workhours',label:'工时记录'},
          {key:'gantt',label:'甘特图'},
        ]}/>

        {detailModal.tab==='info'&&<div className="space-y-4">
          <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {[['项目编号',d.project_no],['客户',d.customer_name],['项目经理',d.manager_name],['销售协调',d.sales_name],['开始日期',fmt.date(d.start_date)],['计划结束',fmt.date(d.end_date)],['实际结束',fmt.date(d.actual_end_date)],['项目预算',fmt.yuan(d.budget)],['实际成本',fmt.yuan(d.actual_cost)],['总工时',`${d.total_hours||0}h`],['人工成本',fmt.yuan(d.labor_cost)]].map(([l,v])=>(
              <div key={l} className="flex gap-2"><span className="text-gray-400 flex-shrink-0 w-20">{l}</span><span className="text-gray-700">{v||'—'}</span></div>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-500">整体进度</span><span className="text-sm font-bold text-gray-700">{d.progress}%</span></div>
            <ProgressBar value={d.progress} color={d.progress>=80?'bg-emerald-500':'bg-blue-500'} showLabel={false}/>
          </div>
          {d.description&&<p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{d.description}</p>}
        </div>}

        {detailModal.tab==='tasks'&&<div>
          <div className="flex justify-end mb-3"><button className="btn-primary btn-sm" onClick={()=>{setTaskForm(INIT_TASK);setTaskModal({open:true,projectId:d.id,mode:'create',data:null})}}>＋ 添加任务</button></div>
          <div className="space-y-2">
            {d.tasks?.map(t=>(
              <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status==='completed'?'bg-emerald-400':t.status==='in_progress'?'bg-blue-400':'bg-gray-300'}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium text-sm ${t.status==='completed'?'line-through text-gray-400':'text-gray-800'}`}>{t.name}</span>
                    <Badge status={t.priority}/>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{t.assignee_name||'未分配'}</span>
                    {t.start_date&&<span>{fmt.date(t.start_date)} → {fmt.date(t.due_date)}</span>}
                  </div>
                </div>
                <div className="w-24 flex-shrink-0"><ProgressBar value={t.progress} showLabel/></div>
                <div className="flex items-center gap-1">
                  <button className="btn-icon text-xs" onClick={()=>{setTaskForm({...t});setTaskModal({open:true,projectId:d.id,mode:'edit',data:t})}}>✏️</button>
                  <button className="btn-icon text-xs" onClick={()=>handleDeleteTask(d.id,t.id)}>🗑️</button>
                </div>
              </div>
            ))}
            {(!d.tasks||!d.tasks.length)&&<div className="text-center py-8 text-gray-400">暂无任务，点击"添加任务"开始</div>}
          </div>
        </div>}

        {detailModal.tab==='milestones'&&<div>
          <div className="flex justify-end mb-3"><button className="btn-primary btn-sm" onClick={()=>{setMsForm(INIT_MS);setMsModal({open:true,projectId:d.id,mode:'create',data:null})}}>＋ 添加里程碑</button></div>
          <div className="space-y-2">
            {d.milestones?.map(m=>(
              <div key={m.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${m.status==='completed'?'bg-emerald-400':m.status==='delayed'?'bg-red-400':'bg-blue-400'}`}/>
                <div className="flex-1"><div className="font-medium text-sm">{m.name}</div><div className="text-xs text-gray-400 mt-0.5">计划：{fmt.date(m.planned_date)}{m.actual_date&&` · 实际：${fmt.date(m.actual_date)}`}</div></div>
                <Badge status={m.status}/>
                <button className="btn-icon text-xs" onClick={()=>{setMsForm({...m});setMsModal({open:true,projectId:d.id,mode:'edit',data:m})}}>✏️</button>
              </div>
            ))}
            {(!d.milestones||!d.milestones.length)&&<div className="text-center py-8 text-gray-400">暂无里程碑</div>}
          </div>
        </div>}

        {detailModal.tab==='workhours'&&<div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">总工时：<strong>{d.total_hours||0}h</strong></span>
              <span className="text-gray-500">人工成本：<strong>{fmt.yuan(d.labor_cost)}</strong></span>
            </div>
            <button className="btn-primary btn-sm" onClick={()=>{setWhForm(INIT_WH);setWhModal({open:true,projectId:d.id})}}>＋ 填报工时</button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {d.workhours?.map(w=>(
              <div key={w.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700 w-24">{w.user_name}</span>
                <span className="text-xs text-gray-400">周：{fmt.date(w.week_start)}</span>
                <span className="font-semibold text-blue-600">{w.hours}h</span>
                {w.hourly_rate>0&&<span className="text-xs text-gray-400">× ¥{w.hourly_rate}/h = {fmt.yuan(w.hours*w.hourly_rate)}</span>}
                {w.content&&<span className="text-xs text-gray-500 flex-1 truncate">{w.content}</span>}
              </div>
            ))}
            {(!d.workhours||!d.workhours.length)&&<div className="text-center py-8 text-gray-400">暂无工时记录</div>}
          </div>
        </div>}

        {detailModal.tab==='gantt'&&<div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">项目甘特图</h4>
            <div className="flex gap-3 text-xs">
              {[{c:'bg-gray-300',l:'待处理'},{c:'bg-blue-400',l:'进行中'},{c:'bg-emerald-400',l:'已完成'},{c:'bg-red-300',l:'已取消'}].map(x=>(
                <span key={x.l} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${x.c}`}/>{x.l}</span>
              ))}
            </div>
          </div>
          {renderGantt(d.tasks)}
        </div>}
      </Modal>}

      {/* Task Modal */}
      <Modal open={taskModal.open} onClose={()=>setTaskModal({...taskModal,open:false})} title={taskModal.mode==='create'?'新建任务':'编辑任务'} width="max-w-lg"
        footer={<><button className="btn-secondary" onClick={()=>setTaskModal({...taskModal,open:false})}>取消</button><button className="btn-primary" onClick={handleTaskSave}>保存</button></>}>
        <div className="space-y-4">
          <FormField label="任务名称" required><input className="form-input" value={taskForm.name} onChange={e=>setTaskForm(f=>({...f,name:e.target.value}))} placeholder="任务名称"/></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="负责人"><select className="form-select" value={taskForm.assignee_id} onChange={e=>setTaskForm(f=>({...f,assignee_id:e.target.value}))}><option value="">请选择</option>{users.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}</select></FormField>
            <FormField label="优先级"><select className="form-select" value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))}>{PRIORITY_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
            <FormField label="开始日期"><input type="date" className="form-input" value={taskForm.start_date||''} onChange={e=>setTaskForm(f=>({...f,start_date:e.target.value}))}/></FormField>
            <FormField label="截止日期"><input type="date" className="form-input" value={taskForm.due_date||''} onChange={e=>setTaskForm(f=>({...f,due_date:e.target.value}))}/></FormField>
            <FormField label="状态"><select className="form-select" value={taskForm.status} onChange={e=>setTaskForm(f=>({...f,status:e.target.value}))}>{TASK_STATUS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
            <FormField label="完成进度(%)"><input type="number" min="0" max="100" className="form-input" value={taskForm.progress||0} onChange={e=>setTaskForm(f=>({...f,progress:e.target.value}))}/></FormField>
          </div>
          <FormField label="任务描述"><textarea className="form-textarea" rows={3} value={taskForm.description||''} onChange={e=>setTaskForm(f=>({...f,description:e.target.value}))} placeholder="任务详情..."/></FormField>
        </div>
      </Modal>

      {/* Milestone Modal */}
      <Modal open={msModal.open} onClose={()=>setMsModal({...msModal,open:false})} title={msModal.mode==='create'?'添加里程碑':'编辑里程碑'} width="max-w-md"
        footer={<><button className="btn-secondary" onClick={()=>setMsModal({...msModal,open:false})}>取消</button><button className="btn-primary" onClick={handleMsSave}>保存</button></>}>
        <div className="space-y-4">
          <FormField label="里程碑名称" required><input className="form-input" value={msForm.name} onChange={e=>setMsForm(f=>({...f,name:e.target.value}))} placeholder="如：需求确认完成"/></FormField>
          <FormField label="计划日期"><input type="date" className="form-input" value={msForm.planned_date||''} onChange={e=>setMsForm(f=>({...f,planned_date:e.target.value}))}/></FormField>
          {msModal.mode==='edit'&&<>
            <FormField label="实际完成日期"><input type="date" className="form-input" value={msForm.actual_date||''} onChange={e=>setMsForm(f=>({...f,actual_date:e.target.value}))}/></FormField>
            <FormField label="状态"><select className="form-select" value={msForm.status||'pending'} onChange={e=>setMsForm(f=>({...f,status:e.target.value}))}>{MS_STATUS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
          </>}
          <FormField label="描述"><textarea className="form-textarea" rows={2} value={msForm.description||''} onChange={e=>setMsForm(f=>({...f,description:e.target.value}))}/></FormField>
        </div>
      </Modal>

      {/* Workhour Modal */}
      <Modal open={whModal.open} onClose={()=>setWhModal({open:false,projectId:null})} title="填报工时" width="max-w-md"
        footer={<><button className="btn-secondary" onClick={()=>setWhModal({open:false,projectId:null})}>取消</button><button className="btn-primary" onClick={handleWhSave}>保存</button></>}>
        <div className="space-y-4">
          <FormField label="周开始日期（周一）" required><input type="date" className="form-input" value={whForm.week_start} onChange={e=>setWhForm(f=>({...f,week_start:e.target.value}))}/></FormField>
          <FormField label="工时（小时）" required><input type="number" min="0" step="0.5" className="form-input" value={whForm.hours} onChange={e=>setWhForm(f=>({...f,hours:e.target.value}))} placeholder="如：8"/></FormField>
          <FormField label="小时单价（元，可选）"><input type="number" min="0" className="form-input" value={whForm.hourly_rate} onChange={e=>setWhForm(f=>({...f,hourly_rate:e.target.value}))} placeholder="0"/></FormField>
          <FormField label="工作内容"><textarea className="form-textarea" rows={3} value={whForm.content} onChange={e=>setWhForm(f=>({...f,content:e.target.value}))} placeholder="本周工作内容描述..."/></FormField>
        </div>
      </Modal>

      {/* Assign PM Modal */}
      <Modal open={assignPMModal.open} onClose={()=>setAssignPMModal({open:false,id:null})} title="指派项目经理" width="max-w-sm"
        footer={<><button className="btn-secondary" onClick={()=>setAssignPMModal({open:false,id:null})}>取消</button><button className="btn-primary" onClick={handleAssignPM}>确认指派</button></>}>
        <FormField label="项目经理" required>
          <select className="form-select" value={assignPMUserId} onChange={e=>setAssignPMUserId(e.target.value)}>
            <option value="">请选择</option>{users.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username} ({u.department||'—'})</option>)}
          </select>
        </FormField>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={()=>setDelConfirm({open:false,id:null})} onConfirm={handleDelete} title="删除项目" message="确定要删除此项目吗？项目下所有任务也将被删除。"/>
    </div>
  )
}
