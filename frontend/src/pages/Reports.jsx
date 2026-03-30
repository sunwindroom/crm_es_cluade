import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { reportsAPI } from '../api'
import { PageHeader, PageLoader } from '../components/common'
import { fmt } from '../hooks'

const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#6366f1','#f97316','#06b6d4']
const MN = {'01':'1月','02':'2月','03':'3月','04':'4月','05':'5月','06':'6月','07':'7月','08':'8月','09':'9月','10':'10月','11':'11月','12':'12月'}
const fmtM = str => { if(!str)return ''; const [,m]=str.split('-'); return MN[m]||m }
const STAGE_NAMES = {prospecting:'意向挖掘',qualification:'需求确认',proposal:'方案报价',negotiation:'商务谈判',closed_won:'赢单',closed_lost:'输单'}

export default function Reports() {
  const [tab,setTab]=useState('overview'); const [loading,setLoading]=useState(true); const [data,setData]=useState({})
  useEffect(()=>{
    Promise.all([reportsAPI.paymentTrend(),reportsAPI.salesFunnel(),reportsAPI.customerSource(),reportsAPI.customerIndustry(),reportsAPI.leadSource(),reportsAPI.opportunityStage(),reportsAPI.staffPerformance(),reportsAPI.monthlyCustomers(),reportsAPI.projectWorkhours()])
    .then(([trend,funnel,cSrc,cInd,lSrc,oStage,staff,moCust,prjWh])=>{
      setData({ trend:trend.data.map(r=>({...r,month:fmtM(r.month),amount:r.amount/10000})), funnel:funnel.data, cSrc:cSrc.data, cInd:cInd.data, lSrc:lSrc.data, oStage:oStage.data, staff:staff.data, moCust:moCust.data.map(r=>({...r,month:fmtM(r.month)})), prjWh:prjWh.data })
      setLoading(false)
    })
  },[])
  if(loading)return <PageLoader/>
  const TABS = [{key:'overview',label:'销售概览'},{key:'customer',label:'客户分析'},{key:'payment',label:'回款分析'},{key:'staff',label:'员工业绩'},{key:'project',label:'项目工时'}]
  return (
    <div className="animate-fade-in">
      <PageHeader title="报表统计" desc="全面的数据分析，助力科学决策"/>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map(t=><button key={t.key} className={`tab-item ${tab===t.key?'tab-item-active':'tab-item-inactive'}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
      </div>
      {tab==='overview'&&<div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">商机阶段分布</span></div><div className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.oStage?.map(d=>({...d,name:STAGE_NAMES[d.stage]||d.stage,amount:(d.amount||0)/10000}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/>
                <Tooltip formatter={(v,n)=>[n==='count'?`${v}个`:`${v}万`,n==='count'?'数量':'金额(万)']}/>
                <Bar dataKey="count" name="count" fill="#3b82f6" radius={[3,3,0,0]}/><Bar dataKey="amount" name="amount" fill="#10b981" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div></div>
          <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">销售漏斗</span></div><div className="p-5 space-y-3">
            {data.funnel?.map((item,i)=>{const max=data.funnel[0]?.count||1;const colors=['#3b82f6','#6366f1','#8b5cf6','#a855f7','#10b981'];return(
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500"><span className="font-medium">{item.name}</span><span>{item.count} 个 · {fmt.wan(item.amount)}</span></div>
                <div className="bg-gray-100 rounded-full overflow-hidden h-8 flex items-center">
                  <div className="h-full rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-700"
                    style={{width:`${Math.max(item.count/max*100,10)}%`,background:colors[i]}}>
                    {item.count>0&&<span className="px-2">{Math.round(item.count/max*100)}%</span>}
                  </div>
                </div>
              </div>
            )})}
          </div></div>
        </div>
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">线索来源转化率</span></div><div className="p-4">
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>来源渠道</th><th className="text-right">线索总数</th><th className="text-right">已转化</th><th className="text-right">转化率</th><th>进度</th></tr></thead>
            <tbody>{data.lSrc?.map(r=>(
              <tr key={r.source}><td className="font-medium">{r.source||'未知'}</td><td className="text-right">{r.total}</td><td className="text-right text-emerald-600 font-medium">{r.converted}</td><td className="text-right font-bold">{r.total>0?`${Math.round(r.converted/r.total*100)}%`:'0%'}</td>
              <td><div className="w-32 bg-gray-100 rounded-full h-2"><div className="h-full bg-blue-500 rounded-full" style={{width:`${r.total>0?r.converted/r.total*100:0}%`}}/></div></td></tr>
            ))}</tbody>
          </table></div>
        </div></div>
      </div>}
      {tab==='customer'&&<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">客户来源分布</span></div><div className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart><Pie data={data.cSrc} cx="50%" cy="50%" outerRadius={100} dataKey="count" nameKey="source" label={({source,percent})=>`${source} ${(percent*100).toFixed(0)}%`}>
              {data.cSrc?.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div></div>
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">客户行业分布</span></div><div className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.cInd} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis type="number" tick={{fontSize:11}}/><YAxis dataKey="industry" type="category" tick={{fontSize:11}} width={60}/>
              <Tooltip/><Bar dataKey="count" fill="#3b82f6" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div></div>
        <div className="card lg:col-span-2"><div className="card-header"><span className="font-semibold text-gray-700">月度新增客户</span></div><div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.moCust}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="month" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/>
              <Tooltip formatter={v=>[v,'新增客户']}/><Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#cg)" strokeWidth={2} dot={{r:3}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div></div>
      </div>}
      {tab==='payment'&&<div className="space-y-6">
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">近12个月回款趋势（万元）</span></div><div className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.trend}>
              <defs><linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="month" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/>
              <Tooltip formatter={v=>[`${v}万`,'回款金额']}/><Area type="monotone" dataKey="amount" stroke="#10b981" fill="url(#pg2)" strokeWidth={2.5} dot={{r:4,fill:'#10b981'}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div></div>
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">月度回款明细</span></div><div className="p-4">
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>月份</th><th className="text-right">回款金额</th><th className="text-right">回款笔数</th><th>环比</th></tr></thead>
            <tbody>{data.trend?.map((r,i)=>{const prev=data.trend?.[i-1];const change=prev&&prev.amount>0?((r.amount-prev.amount)/prev.amount*100).toFixed(1):null;return(
              <tr key={r.month}><td className="font-medium">{r.month}</td><td className="text-right font-bold">{r.amount}万</td><td className="text-right">{r.count}笔</td>
              <td>{change!==null?<span className={`text-sm font-medium ${parseFloat(change)>=0?'text-emerald-500':'text-red-500'}`}>{parseFloat(change)>=0?'↑':'↓'} {Math.abs(change)}%</span>:'—'}</td></tr>
            )})}
            </tbody>
          </table></div>
        </div></div>
      </div>}
      {tab==='staff'&&<div className="space-y-6">
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">员工业绩对比</span></div><div className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.staff?.slice(0,10).map(s=>({...s,won_amount:(s.won_amount||0)/10000,payment_amount:(s.payment_amount||0)/10000}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/>
              <Tooltip formatter={v=>[`${v}万`]}/><Legend iconSize={10} formatter={v=>v==='won_amount'?'赢单金额(万)':'回款金额(万)'}/>
              <Bar dataKey="won_amount" fill="#3b82f6" radius={[3,3,0,0]}/><Bar dataKey="payment_amount" fill="#10b981" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div></div>
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">员工业绩排行榜</span></div><div className="p-4">
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>排名</th><th>姓名</th><th>角色</th><th className="text-right">线索</th><th className="text-right">客户</th><th className="text-right">赢单数</th><th className="text-right">赢单金额</th><th className="text-right">回款金额</th></tr></thead>
            <tbody>{data.staff?.map((s,i)=>(
              <tr key={s.name}><td><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i===0?'bg-amber-400 text-white':i===1?'bg-gray-400 text-white':i===2?'bg-orange-400 text-white':'bg-gray-100 text-gray-600'}`}>{i+1}</span></td>
              <td className="font-medium">{s.name}</td><td className="text-gray-500 text-xs">{s.role_name}</td>
              <td className="text-right">{s.leads_count}</td><td className="text-right">{s.customers_count}</td>
              <td className="text-right text-emerald-600 font-medium">{s.won_count}</td>
              <td className="text-right font-semibold">{fmt.wan(s.won_amount)}</td>
              <td className="text-right font-semibold text-blue-600">{fmt.wan(s.payment_amount)}</td></tr>
            ))}</tbody>
          </table></div>
        </div></div>
      </div>}
      {tab==='project'&&<div className="space-y-6">
        <div className="card"><div className="card-header"><span className="font-semibold text-gray-700">项目工时统计</span></div><div className="p-4">
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>项目名称</th><th>编号</th><th>状态</th><th className="text-right">总工时(h)</th><th className="text-right">人工成本</th><th className="text-right">预算</th><th className="text-right">成本占比</th></tr></thead>
            <tbody>{data.prjWh?.map(p=>(
              <tr key={p.project_no}><td className="font-medium">{p.project_name}</td><td className="font-mono text-xs text-gray-500">{p.project_no}</td><td>{p.status}</td>
              <td className="text-right font-semibold text-blue-600">{p.total_hours}h</td>
              <td className="text-right">{fmt.yuan(p.labor_cost)}</td>
              <td className="text-right">{fmt.yuan(p.budget)}</td>
              <td className="text-right">{p.budget>0?`${Math.round(p.labor_cost/p.budget*100)}%`:'—'}</td></tr>
            ))}</tbody>
          </table></div>
        </div></div>
      </div>}
    </div>
  )
}
