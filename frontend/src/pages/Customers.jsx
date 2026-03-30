import { useState, useEffect, useCallback } from 'react'
import { customersAPI, systemAPI } from '../api'
import { useNotifyStore, useAuthStore, ROLE_PERMS, hasRole } from '../store'
import { Modal, ConfirmDialog, Pagination, SearchBar, Table, PageHeader, FormField, Tabs } from '../components/common'
import { Badge, fmt, LEAD_SOURCES, INDUSTRIES, REGIONS, FOLLOWUP_TYPES } from '../hooks'

const LEVEL_OPTS = [{value:'normal',label:'普通'},{value:'important',label:'重要'},{value:'vip',label:'VIP'}]
const STATUS_OPTS = [{value:'active',label:'正常'},{value:'inactive',label:'非活跃'},{value:'blacklist',label:'黑名单'}]
const TYPE_OPTS = [{value:'company',label:'企业'},{value:'personal',label:'个人'}]
const INIT_FORM = {name:'',type:'company',industry:'',level:'normal',status:'active',region:'',address:'',website:'',phone:'',email:'',contact_name:'',contact_phone:'',contact_email:'',source:'',remark:'',owner_id:''}
const INIT_FU = {content:'',followup_type:'call',followup_time:'',next_followup_time:''}

export default function Customers() {
  const [list,setList]=useState([]); const [total,setTotal]=useState(0); const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(false); const [perms,setPerms]=useState({})
  const [filters,setFilters]=useState({keyword:'',status:'',level:'',industry:''})
  const [modal,setModal]=useState({open:false,mode:'create',data:null})
  const [detailModal,setDetailModal]=useState({open:false,data:null})
  const [detailTab,setDetailTab]=useState('info')
  const [form,setForm]=useState(INIT_FORM); const [saving,setSaving]=useState(false)
  const [delConfirm,setDelConfirm]=useState({open:false,id:null})
  const [fuModal,setFuModal]=useState({open:false,customerId:null})
  const [fuForm,setFuForm]=useState(INIT_FU)
  const [assignModal,setAssignModal]=useState({open:false,id:null})
  const [assignUserId,setAssignUserId]=useState('')
  const [allUsers,setAllUsers]=useState([])
  const notify=useNotifyStore(s=>s.notify)
  const user=useAuthStore(s=>s.user)
  const roleName=user?.role_name||''
  const PAGE_SIZE=10

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const res=await customersAPI.list({page,pageSize:PAGE_SIZE,...filters})
      setList(res.data.list);setTotal(res.data.total)
      setPerms({canDelete:res.data.canDelete,canEdit:res.data.canEdit})
    }finally{setLoading(false)}
  },[page,filters])

  useEffect(()=>{load()},[load])
  useEffect(()=>{systemAPI.listUsers({pageSize:200}).then(r=>setAllUsers(r.data.list))},[])

  const openCreate=()=>{setForm(INIT_FORM);setModal({open:true,mode:'create',data:null})}
  const openEdit=(row)=>{setForm({...row});setModal({open:true,mode:'edit',data:row})}
  const openDetail=async(row)=>{const res=await customersAPI.get(row.id);setDetailModal({open:true,data:res.data});setDetailTab('info')}
  const refreshDetail=async(id)=>{const res=await customersAPI.get(id);setDetailModal(d=>({...d,data:res.data}))}

  const handleSave=async()=>{
    if(!form.name)return notify('error','客户名称必填')
    setSaving(true)
    try{
      if(modal.mode==='create'){await customersAPI.create(form);notify('success','客户创建成功')}
      else{await customersAPI.update(modal.data.id,form);notify('success','客户更新成功')}
      setModal({...modal,open:false});load()
    }catch(e){notify('error',e?.message||'操作失败')}finally{setSaving(false)}
  }
  const handleDelete=async()=>{
    try{await customersAPI.remove(delConfirm.id);notify('success','删除成功');setDelConfirm({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'删除失败')}
  }
  const handleFu=async()=>{
    if(!fuForm.content)return notify('error','跟进内容不能为空')
    try{
      await customersAPI.addFollowup(fuModal.customerId,fuForm)
      notify('success','跟进记录已添加');setFuModal({open:false,customerId:null});setFuForm(INIT_FU)
      if(detailModal.open)refreshDetail(detailModal.data.id)
    }catch(e){notify('error',e?.message||'失败')}
  }
  const handleAssign=async()=>{
    if(!assignUserId)return notify('error','请选择接收人')
    try{await customersAPI.assign(assignModal.id,{assignee_id:assignUserId});notify('success','分配成功');setAssignModal({open:false,id:null});load()}
    catch(e){notify('error',e?.message||'分配失败')}
  }

  const setFilter=(k,v)=>{setFilters(f=>({...f,[k]:v}));setPage(1)}
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const d=detailModal.data

  const columns=[
    {key:'name',title:'客户名称',render:(v,r)=><button className="font-medium text-blue-600 hover:underline text-left" onClick={()=>openDetail(r)}>{v}</button>},
    {key:'level',title:'级别',render:v=><Badge status={v}/>},
    {key:'industry',title:'行业'},
    {key:'region',title:'地区'},
    {key:'contact_name',title:'联系人',render:(v,r)=><span>{v} <span className="text-gray-400 text-xs">{r.contact_phone}</span></span>},
    {key:'status',title:'状态',render:v=><Badge status={v}/>},
    {key:'owner_name',title:'负责人'},
    {key:'created_at',title:'创建',render:v=>fmt.date(v)},
    {key:'actions',title:'操作',width:'200px',render:(_,r)=>(
      <div className="flex items-center gap-1 flex-wrap">
        <button className="btn btn-sm text-blue-600 hover:bg-blue-50 border-0 shadow-none" onClick={()=>openEdit(r)}>编辑</button>
        <button className="btn btn-sm text-purple-600 hover:bg-purple-50 border-0 shadow-none" onClick={()=>{setFuModal({open:true,customerId:r.id});setFuForm(INIT_FU)}}>跟进</button>
        <button className="btn btn-sm text-teal-600 hover:bg-teal-50 border-0 shadow-none" onClick={()=>{setAssignModal({open:true,id:r.id});setAssignUserId('')}}>分配</button>
        {perms.canDelete&&<button className="btn btn-sm text-red-500 hover:bg-red-50 border-0 shadow-none" onClick={()=>setDelConfirm({open:true,id:r.id})}>删除</button>}
      </div>
    )},
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="客户管理" desc="管理客户信息，记录拜访跟进，维护客户关系"
        actions={<button className="btn-primary" onClick={openCreate}>＋ 新建客户</button>}/>
      <div className="filter-bar shadow-sm">
        <SearchBar value={filters.keyword} onChange={v=>setFilter('keyword',v)} placeholder="搜索客户名称、联系人、电话..." onSearch={load}/>
        <select className="form-select w-28" value={filters.level} onChange={e=>setFilter('level',e.target.value)}>
          <option value="">全部级别</option>{LEVEL_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-select w-28" value={filters.status} onChange={e=>setFilter('status',e.target.value)}>
          <option value="">全部状态</option>{STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-select w-28" value={filters.industry} onChange={e=>setFilter('industry',e.target.value)}>
          <option value="">全部行业</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
        </select>
        <button className="btn-secondary btn-sm ml-auto" onClick={()=>{setFilters({keyword:'',status:'',level:'',industry:''});setPage(1)}}>重置</button>
      </div>
      <div className="card"><Table columns={columns} data={list} loading={loading}/><div className="px-4 pb-2"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage}/></div></div>

      {/* Form Modal */}
      <Modal open={modal.open} onClose={()=>setModal({...modal,open:false})} title={modal.mode==='create'?'新建客户':'编辑客户'} width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={()=>setModal({...modal,open:false})}>取消</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'保存中...':'保存'}</button></>}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="客户名称" required><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="公司/个人名称"/></FormField>
          <FormField label="客户类型"><select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)}>{TYPE_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
          <FormField label="所属行业"><select className="form-select" value={form.industry} onChange={e=>set('industry',e.target.value)}><option value="">请选择</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}</select></FormField>
          <FormField label="客户级别"><select className="form-select" value={form.level} onChange={e=>set('level',e.target.value)}>{LEVEL_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></FormField>
          <FormField label="所在地区"><select className="form-select" value={form.region} onChange={e=>set('region',e.target.value)}><option value="">请选择</option>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</select></FormField>
          <FormField label="客户来源"><select className="form-select" value={form.source} onChange={e=>set('source',e.target.value)}><option value="">请选择</option>{LEAD_SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></FormField>
          <FormField label="联系电话"><input className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="公司电话"/></FormField>
          <FormField label="邮箱"><input className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="公司邮箱"/></FormField>
          <FormField label="主要联系人"><input className="form-input" value={form.contact_name} onChange={e=>set('contact_name',e.target.value)} placeholder="联系人姓名"/></FormField>
          <FormField label="联系人电话"><input className="form-input" value={form.contact_phone} onChange={e=>set('contact_phone',e.target.value)} placeholder="联系人手机"/></FormField>
          <FormField label="联系人邮箱"><input className="form-input" value={form.contact_email} onChange={e=>set('contact_email',e.target.value)} placeholder="联系人邮箱"/></FormField>
          <FormField label="网站"><input className="form-input" value={form.website} onChange={e=>set('website',e.target.value)} placeholder="https://..."/></FormField>
          {hasRole(roleName,ROLE_PERMS.CAN_EDIT_ANY)&&<FormField label="负责人"><select className="form-select" value={form.owner_id||''} onChange={e=>set('owner_id',e.target.value)}><option value="">当前用户</option>{allUsers.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username}</option>)}</select></FormField>}
          <div className="col-span-2"><FormField label="地址"><input className="form-input" value={form.address} onChange={e=>set('address',e.target.value)} placeholder="详细地址"/></FormField></div>
          <div className="col-span-2"><FormField label="备注"><textarea className="form-textarea" rows={3} value={form.remark} onChange={e=>set('remark',e.target.value)} placeholder="备注..."/></FormField></div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {d&&<Modal open={detailModal.open} onClose={()=>setDetailModal({open:false,data:null})}
        title={<span className="flex items-center gap-2">{d.name} <Badge status={d.level}/></span>} width="max-w-3xl"
        footer={<><button className="btn-secondary" onClick={()=>setDetailModal({open:false,data:null})}>关闭</button><button className="btn-primary" onClick={()=>{setDetailModal({open:false,data:null});openEdit(d)}}>编辑</button><button className="btn-success btn-sm" onClick={()=>{setFuModal({open:true,customerId:d.id});setFuForm(INIT_FU)}}>+ 跟进</button></>}>
        <Tabs active={detailTab} onChange={setDetailTab} items={[
          {key:'info',label:'基本信息'},{key:'contacts',label:'联系人',count:d.contacts?.length},{key:'followups',label:'跟进记录',count:d.followups?.length},
        ]}/>
        {detailTab==='info'&&<div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[['客户名称',d.name],['客户类型',d.type==='company'?'企业':'个人'],['所属行业',d.industry],['客户级别',<Badge status={d.level}/>],['所在地区',d.region],['客户来源',d.source],['联系电话',d.phone],['邮箱',d.email],['主要联系人',d.contact_name],['联系人电话',d.contact_phone],['网站',d.website],['负责人',d.owner_name]].map(([l,v])=>(
            <div key={l} className="flex gap-2"><span className="text-gray-400 flex-shrink-0 w-20">{l}</span><span className="text-gray-700">{v||'—'}</span></div>
          ))}
          {d.remark&&<div className="col-span-2 flex gap-2"><span className="text-gray-400 flex-shrink-0 w-20">备注</span><span className="text-gray-700">{d.remark}</span></div>}
        </div>}
        {detailTab==='contacts'&&<div className="space-y-3">
          {!d.contacts?.length&&<div className="text-center py-8 text-gray-400">暂无联系人</div>}
          {d.contacts?.map(c=>(
            <div key={c.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">{c.name[0]}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{c.name} {c.is_primary?<span className="badge-green ml-1 text-xs">主要</span>:''}</div>
                <div className="text-xs text-gray-500">{c.position} · {c.phone} · {c.email}</div>
              </div>
            </div>
          ))}
        </div>}
        {detailTab==='followups'&&<div className="space-y-3 max-h-80 overflow-y-auto">
          {!d.followups?.length&&<div className="text-center py-8 text-gray-400">暂无跟进记录</div>}
          {d.followups?.map(f=>(
            <div key={f.id} className="flex gap-3 p-3 border border-gray-100 rounded-lg">
              <div className="w-1.5 bg-blue-200 rounded-full flex-shrink-0"/>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-blue text-xs">{FOLLOWUP_TYPES.find(t=>t.value===f.followup_type)?.label||f.followup_type}</span>
                  <span className="text-xs text-gray-400">{fmt.datetime(f.followup_time)}</span>
                  <span className="text-xs text-gray-400">· {f.creator_name}</span>
                </div>
                <p className="text-sm text-gray-700">{f.content}</p>
                {f.next_followup_time&&<p className="text-xs text-blue-500 mt-1">下次跟进：{fmt.date(f.next_followup_time)}</p>}
              </div>
            </div>
          ))}
        </div>}
      </Modal>}

      {/* Followup Modal */}
      <Modal open={fuModal.open} onClose={()=>setFuModal({open:false,customerId:null})} title="添加拜访/跟进记录" width="max-w-lg"
        footer={<><button className="btn-secondary" onClick={()=>setFuModal({open:false,customerId:null})}>取消</button><button className="btn-primary" onClick={handleFu}>保存</button></>}>
        <div className="space-y-4">
          <FormField label="跟进方式"><select className="form-select" value={fuForm.followup_type} onChange={e=>setFuForm(f=>({...f,followup_type:e.target.value}))}>{FOLLOWUP_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></FormField>
          <FormField label="跟进时间"><input type="datetime-local" className="form-input" value={fuForm.followup_time} onChange={e=>setFuForm(f=>({...f,followup_time:e.target.value}))}/></FormField>
          <FormField label="跟进内容" required><textarea className="form-textarea" rows={4} value={fuForm.content} onChange={e=>setFuForm(f=>({...f,content:e.target.value}))} placeholder="详细描述本次拜访/跟进情况..."/></FormField>
          <FormField label="下次跟进时间"><input type="date" className="form-input" value={fuForm.next_followup_time} onChange={e=>setFuForm(f=>({...f,next_followup_time:e.target.value}))}/></FormField>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal open={assignModal.open} onClose={()=>setAssignModal({open:false,id:null})} title="分配客户" width="max-w-sm"
        footer={<><button className="btn-secondary" onClick={()=>setAssignModal({open:false,id:null})}>取消</button><button className="btn-primary" onClick={handleAssign}>确认分配</button></>}>
        <FormField label="接收人" required>
          <select className="form-select" value={assignUserId} onChange={e=>setAssignUserId(e.target.value)}>
            <option value="">请选择接收人</option>
            {allUsers.map(u=><option key={u.id} value={u.id}>{u.real_name||u.username} ({u.department||'—'})</option>)}
          </select>
        </FormField>
      </Modal>

      <ConfirmDialog open={delConfirm.open} onClose={()=>setDelConfirm({open:false,id:null})} onConfirm={handleDelete} title="删除客户" message="确定要删除此客户吗？相关跟进记录也将一并删除。"/>
    </div>
  )
}
