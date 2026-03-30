import { useState, useEffect, useCallback } from 'react'
import { contractsAPI, customersAPI, oppsAPI, systemAPI } from '../api'
import { useNotifyStore, useAuthStore, ROLE_PERMS, hasRole } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, Tabs } from '../components/common'
import { Badge, fmt } from '../hooks'

const STATUS_OPTS = [{value:'draft',label:'草稿'},{value:'review',label:'审批中'},{value:'signed',label:'已签署'},{value:'rejected',label:'已驳回'},{value:'expired',label:'已到期'}]
const TYPE_OPTS = [{value:'sales',label:'销售合同'},{value:'service',label:'服务合同'},{value:'framework',label:'框架合同'},{value:'supplement',label:'补充协议'}]
const INIT_FORM = {name:'',customer_id:'',customer_name:'',opportunity_id:'',type:'sales',amount:'',sign_date:'',start_date:'',end_date:'',payment_terms:'',remark:'',owner_id:''}
const INIT_PLAN = {name:'',amount:'',planned_date:'',remark:''}

export default function Contracts() {
  const [list,setList]=useState([]); const [total,setTotal]=useState(0); const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(false); const [canCreate,setCanCreate]=useState(false)
  const [filters,setFilters]=useState({keyword:'',status:'',type:''})
  const [modal,setModal]=useState({open:false,mode:'create',data:null})
  const [detailModal,setDetailModal]=useState({open:false,data:null,tab:'info'})
  const [form,setForm]=useState(INIT_FORM)
  const [paymentPlans,setPaymentPlans]=useState([{...INIT_PLAN}])
  const [saving,setSaving]=useState(false)
  const [delConfirm,setDelConfirm]=useState({open:false,id:null})
  const [approveModal,setApproveModal]=useState({open:false,id:null,action:''})
  const [customers,setCustomers]=useState([]); const [opps,setOpps]=useState([]); const [allUsers,setAllUsers]=useState([])
  const notify=useNotifyStore(s=>s.notify)
  const user=useAuthStore(s=>s.user)
  const roleName=user?.role_name||''
  const PAGE_SIZE=10

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const res=await contractsAPI.list({page,pageSize:PAGE_SIZE,...filters})
      setList(res.data.list);setTotal(res.data.total);setCanCreate(res.data.canCreate)
    }finally{setLoading(false)}
  },[page,filters])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    customersAPI.list({pageSize:200}).then(r=>setCustomers(r.data.list))
    oppsAPI.list({pageSize:200}).then(r=>setOpps(r.data.list))
    systemAPI.listUsers({pageSize:200}).then(r=>setAllUsers(r.data.list))
  },[])

  const openCreate=()=>{setForm(INIT_FORM);setPaymentPlans([{...INIT_PLAN}]);setModal({open:true,mode:'create',data:null})}
  const openEdit=async(row)=>{
    const res=await contractsAPI.get(row.id)
    setForm({...row})
    setPaymentPlans(res.data.payment_plans?.length?res.data.payment_plans.map(p=>({name:p.name||'',amount:p.amount,planned_date:p.planned_date,remark:p.remark||''})): [{...INIT_PLAN}])
    setModal({open:true,mode:'edit',data:row})
  }
  const openDetail=async(row)=>{const res=await contractsAPI.get(row.id);setDetailModal({open:true,data:res.data,tab:'info'})}

  const handleSave=async()=>{
    if(!form.name||!form.customer_id)return notify('error','合同名称和客户必填')
    if(!paymentPlans.length||paymentPlans.some(p=>!p.amount||!p.planned_date))return notify('error','请完整填写所有回款节点的金额和日期')
    setSaving(true)
    try{
      if(modal.mode==='create'){await contractsAPI.create({...form,payment_plans:paymentPlans});notify('success','合同创建成功')}
      else{
        await contractsAPI.update(modal.data.id,form)
        await contractsAPI.savePlans(modal.data.id,{plans:paymentPlans})
        notify('success','合同更新成功')
      }
      setModal({...modal,open:false});load()
    }catch(e){notify('error',e?.message||'操作失败')}finally{setSaving(false)}
  }
  const handleDelete=async()=>{
    try{await contractsAPI.remove(delConfirm.id);notify('success','删除成功');setDelConfirm({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'删除失败')}
  }
  const handleApprove=async()=>{
    try{
      await contractsAPI.approve(approveModal.id,{action:approveModal.action})
      notify('success',approveModal.action==='approve'?'审批通过':'合同已驳回')
      setApproveModal({open:false,id:null,action:''});load()
    }catch(e){notify('error',e?.message||'操作失败')}
  }

  const addPlan=()=>setPaymentPlans(p=>[...p,{...INIT_PLAN}])
  const removePlan=(i)=>setPaymentPlans(p=>p.filter((_,idx)=>idx!==i))
  const updatePlan=(i,k,v)=>setPaymentPlans(p=>p.map((item,idx)=>idx===i?{...item,[k]:v}:item))
  const setFilter=(k,v)=>{setFilters(f=>({...f,[k]:v}));setPage(1)}
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const d=detailModal.data

  const planSumOk=paymentPlans.reduce((s,p)=>s+(parseFloat(p.amount)||0),0)
  const formAmount=parseFloat(form.amount)||0

  const columns=[
    {key:'contract_no',title:'合同编号',render:v=><span className="font-mono text-xs text-gray-500">{v}</span>},
    {key:'name',title:'合同名称',render:(v,r)=><button className="font-medium text-blue-600 hover:underline text-left" onClick={()=>openDetail(r)}>{v}</button>},
    {key:'customer_name',title:'客户'},
    {key:'type',title:'类型',render:v=><span className="text-xs text-gray-600">{TYPE_OPTS.find(t=>t.value===v)?.label||v}</span>},
    {key:'amount',title:'合同金额',render:v=><span className="font-semibold text-gray-800">{fmt.yuan(v)}</span>,align:'right'},
    {key:'paid_amount',title:'已回款',render:v=><span className="text-emerald-600">{fmt.yuan(v)}</span>,align:'right'},
    {key:'plan_count',title:'回款节点',render:v=><span className="badge-blue">{v}期</span>},
    {key:'status',title:'状态',render:v=><Badge status={v}/>},
    {key:'sign_date',title:'签署日期',render:v=>fmt.date(v)},
    {key:'owner_name',title:'负责人'},
    {key:'actions',title:'操作',width:'200px',render:(_,r)=>(
      <div className="flex items-center gap-1 flex-wrap">
        {canCreate&&<button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={()=>openEdit(r)}>编辑</button>}
        {r.status==='review'&&hasRole(roleName,['系统管理员','总裁','营销副总裁','技术副总裁'])&&<>
          <button className="btn btn-sm text-emerald-600 hover:bg-emerald-50 border-0 shadow-none" onClick={()=>setApproveModal({open:true,id:r.id,action:'approve'})}>通过</button>
          <button className="btn btn-sm text-amber-600 hover:bg-amber-50 border-0 shadow-none" onClick={()=>setApproveModal({open:true,id:r.id,action:'reject'})}>驳回</button>
        </>}
        <button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={()=>setDelConfirm({open:true,id:r.id})}>删除</button>
      </div>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="合同管理" desc="管理销售合同，设置回款节点，追踪回款进度"
        actions={canCreate&&<button className="btn-primary" onClick={openCreate}>＋ 新建合同</button>}/>
      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v=>setFilter('keyword',v)} placeholder="搜索合同名称、编号、客户..." onSearch={load}/>
        <select className="form-select w-32" value={filters.status} onChange={e=>setFilter('status',e.target.value)}>
          <option value="">全部状态</option>{STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-select w-32" value={filters.type} onChange={e=>setFilter('type',e.target.value)}>
          <option value="">全部类型</option>{TYPE_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={()=>{setFilters({keyword:'',status:'',type:''});setPage(1)}}>重置</button>
      </div>
      <div className="card"><Table columns={columns} data={list} loading={loading}/><div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage}/></div></div>

      {/* Form Modal */}
      <Modal open={modal.open} onClose={()=>setModal({...modal,open:false})} title={modal.mode==='create'?'新建合同':'编辑合同'} width="max-w-4xl"
        footer={<><button className="btn-secondary" onClick={()=>setModal({...modal,open:false})}>取消</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'保存中...':'保存'}</button></>}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><FormField label="合同名称" required><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="合同名称"/></FormField></div>
            <FormField label="关联客户" required>
              <select className="form-select" value={form.customer_id} onChange={e=>{const c=customers.find(x=>x.id==e.target.value);setForm(f=>({...f,customer_id:e.target.value,customer_name:c?.name||''}))}}>
                <option value="">请选择</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="关联商机">
              <select className="form-select" value={form.opportunity_id||''} onChange={e=>set('opportunity_id',e.target.value)}>
                <option value="">不关联</option>{opps.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FormField>
            <FormField label="合同类型"><select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)}>{TYPE_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
            <FormField label="合同金额（元）"><input type="number" className="form-input" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00"/></FormField>
            <FormField label="签署日期"><input type="date" className="form-input" value={form.sign_date||''} onChange={e=>set('sign_date',e.target.value)}/></FormField>
            <FormField label="开始日期"><input type="date" className="form-input" value={form.start_date||''} onChange={e=>set('start_date',e.target.value)}/></FormField>
            <FormField label="结束日期"><input type="date" className="form-input" value={form.end_date||''} onChange={e=>set('end_date',e.target.value)}/></FormField>
            {modal.mode==='edit'&&<FormField label="合同状态"><select className="form-select" value={form.status||'draft'} onChange={e=>set('status',e.target.value)}>{STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>}
            {hasRole(roleName,ROLE_PERMS.CAN_EDIT_ANY)&&<FormField label="负责人"><select className="form-select" value={form.owner_id||''} onChange={e=>set('owner_id',e.target.value)}><option value="">当前用户</option>{allUsers.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}</select></FormField>}
            <div className="col-span-2"><FormField label="付款条款"><textarea className="form-textarea" rows={2} value={form.payment_terms||''} onChange={e=>set('payment_terms',e.target.value)} placeholder="如：合同签订后30天内支付30%..."/></FormField></div>
            <div className="col-span-2"><FormField label="备注"><textarea className="form-textarea" rows={2} value={form.remark||''} onChange={e=>set('remark',e.target.value)} placeholder="备注..."/></FormField></div>
          </div>

          {/* Payment Plans */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-700">回款节点 <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">（至少填写一个节点）</span></h4>
              <div className="flex items-center gap-3">
                {formAmount>0&&<span className={`text-sm ${Math.abs(planSumOk-formAmount)<0.01?'text-emerald-600':'text-amber-600'}`}>
                  节点合计：{fmt.yuan(planSumOk)} {Math.abs(planSumOk-formAmount)>0.01&&`（差额：${fmt.yuan(formAmount-planSumOk)}）`}
                </span>}
                <button className="btn-secondary btn-sm" onClick={addPlan}>＋ 添加节点</button>
              </div>
            </div>
            <div className="space-y-2">
              {paymentPlans.map((p,i)=>(
                <div key={i} className="grid grid-cols-4 gap-2 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <FormField label={`节点${i+1}名称`}><input className="form-input" value={p.name} onChange={e=>updatePlan(i,'name',e.target.value)} placeholder={`第${i+1}期款`}/></FormField>
                  <FormField label="金额（元）" required><input type="number" className="form-input" value={p.amount} onChange={e=>updatePlan(i,'amount',e.target.value)} placeholder="0.00"/></FormField>
                  <FormField label="计划到期日" required><input type="date" className="form-input" value={p.planned_date} onChange={e=>updatePlan(i,'planned_date',e.target.value)}/></FormField>
                  <div className="flex items-center gap-2">
                    <FormField label="备注"><input className="form-input" value={p.remark} onChange={e=>updatePlan(i,'remark',e.target.value)} placeholder="可选"/></FormField>
                    {paymentPlans.length>1&&<button className="btn-danger btn-sm mt-5 flex-shrink-0" onClick={()=>removePlan(i)}>✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {d&&<Modal open={detailModal.open} onClose={()=>setDetailModal({open:false,data:null,tab:'info'})}
        title={<div className="flex items-center gap-2">{d.name} <Badge status={d.status}/></div>} width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={()=>setDetailModal({...detailModal,open:false})}>关闭</button></>}>
        <Tabs active={detailModal.tab} onChange={t=>setDetailModal(x=>({...x,tab:t}))} items={[{key:'info',label:'合同详情'},{key:'plans',label:`回款节点(${d.payment_plans?.length||0})`},{key:'payments',label:`回款记录(${d.payments?.length||0})`}]}/>
        {detailModal.tab==='info'&&<div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[['合同编号',d.contract_no],['客户名称',d.customer_name],['合同类型',TYPE_OPTS.find(t=>t.value===d.type)?.label],['合同金额',fmt.yuan(d.amount)],['已回款',<span className="text-emerald-600 font-medium">{fmt.yuan(d.paid_amount)}</span>],['待回款',<span className="text-amber-600 font-medium">{fmt.yuan(d.unpaid_amount)}</span>],['签署日期',fmt.date(d.sign_date)],['开始日期',fmt.date(d.start_date)],['结束日期',fmt.date(d.end_date)],['负责人',d.owner_name]].map(([l,v])=>(
            <div key={l} className="flex gap-2"><span className="text-gray-400 w-20 flex-shrink-0">{l}</span><span className="text-gray-700">{v||'—'}</span></div>
          ))}
          {d.payment_terms&&<div className="col-span-2 bg-blue-50 rounded-lg p-3 text-sm text-blue-800"><strong>付款条款：</strong>{d.payment_terms}</div>}
        </div>}
        {detailModal.tab==='plans'&&<div className="space-y-2">
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm mb-3">
            <span className="text-gray-500">合同总额：<strong className="text-gray-800">{fmt.yuan(d.amount)}</strong></span>
            <span className="text-gray-500">已回款：<strong className="text-emerald-600">{fmt.yuan(d.paid_amount)}</strong></span>
            <span className="text-gray-500">待回款：<strong className="text-amber-600">{fmt.yuan(d.unpaid_amount)}</strong></span>
          </div>
          {d.payment_plans?.map(p=>{
            const colorMap={red:'bg-red-50 border-red-200',orange:'bg-orange-50 border-orange-200',yellow:'bg-yellow-50 border-yellow-200',blue:'bg-blue-50 border-blue-200',green:'bg-green-50 border-green-200'}
            return(
              <div key={p.id} className={`flex items-center gap-4 p-3 rounded-lg border ${colorMap[p.countdown_color]||colorMap.blue}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium text-sm">{p.name||`第${p.plan_no}期`}</span><Badge status={p.status}/></div>
                  <div className="text-xs text-gray-500 mt-0.5">计划日期：{fmt.date(p.planned_date)}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{fmt.yuan(p.amount)}</div>
                  <div className={`text-xs mt-0.5 font-medium ${p.is_overdue?'text-red-600':'text-gray-500'}`}>{p.countdown_label}</div>
                </div>
              </div>
            )
          })}
          {!d.payment_plans?.length&&<div className="text-center py-8 text-gray-400">暂无回款节点</div>}
        </div>}
        {detailModal.tab==='payments'&&<div className="space-y-3">
          {!d.payments?.length&&<div className="text-center py-8 text-gray-400">暂无回款记录</div>}
          {d.payments?.map(p=>(
            <div key={p.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status==='confirmed'?'bg-emerald-400':'bg-amber-400'}`}/>
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="font-medium text-sm">{p.payment_no}</span><Badge status={p.status}/></div>
                <div className="text-xs text-gray-400 mt-0.5">{fmt.date(p.payment_date)} · {p.payment_method}</div>
              </div>
              <span className="font-semibold text-gray-800">{fmt.yuan(p.amount)}</span>
            </div>
          ))}
        </div>}
      </Modal>}

      <ConfirmDialog open={approveModal.open} onClose={()=>setApproveModal({open:false,id:null,action:''})} onConfirm={handleApprove} title={approveModal.action==='approve'?'审批通过':'驳回合同'} message={approveModal.action==='approve'?'确认通过此合同审批吗？':'确认驳回此合同吗？'}/>
      <ConfirmDialog open={delConfirm.open} onClose={()=>setDelConfirm({open:false,id:null})} onConfirm={handleDelete} title="删除合同" message="确定要删除此合同吗？"/>
    </div>
  )
}
