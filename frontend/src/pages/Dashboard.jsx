import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { reportsAPI } from '../api'
import { StatCard, PageLoader } from '../components/common'
import { fmt } from '../hooks'

const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#6366f1']
const MONTH_NAMES = {'01':'1月','02':'2月','03':'3月','04':'4月','05':'5月','06':'6月','07':'7月','08':'8月','09':'9月','10':'10月','11':'11月','12':'12月'}
function fmtMonth(str) { if(!str)return ''; const [,m]=str.split('-'); return MONTH_NAMES[m]||m }

export default function Dashboard() {
  const [stats,setStats]=useState(null); const [trend,setTrend]=useState([]); const [funnel,setFunnel]=useState([])
  const [industry,setIndustry]=useState([]); const [performance,setPerformance]=useState([])
  const [alerts,setAlerts]=useState([]); const [loading,setLoading]=useState(true)
  const navigate=useNavigate()

  useEffect(()=>{
    Promise.all([reportsAPI.dashboard(),reportsAPI.paymentTrend(),reportsAPI.salesFunnel(),reportsAPI.customerIndustry(),reportsAPI.staffPerformance(),reportsAPI.paymentPlanAlerts()])
    .then(([d,t,f,ind,perf,al])=>{
      setStats(d.data); setTrend(t.data.map(r=>({...r,month:fmtMonth(r.month),amount:r.amount/10000})))
      setFunnel(f.data); setIndustry(ind.data); setPerformance(perf.data.slice(0,5))
      setAlerts(al.data.filter(a=>a.days_until<=30).slice(0,5)); setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  if(loading)return <PageLoader/>
  const s=stats||{}

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h2 className="text-xl font-bold text-gray-800">工作台</h2><p className="text-sm text-gray-500 mt-1">欢迎回来！以下是您的业务概览</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🎯" iconBg="bg-blue-50" title="线索总数" value={s.leads?.total??0} sub={`本月新增 ${s.leads?.this_month??0} 条`}/>
        <StatCard icon="👥" iconBg="bg-purple-50" title="客户总数" value={s.customers?.total??0} sub={`本月新增 ${s.customers?.this_month??0} 个`}/>
        <StatCard icon="💡" iconBg="bg-amber-50" title="进行中商机" value={s.opportunities?.total??0} sub={`总金额 ${fmt.wan(s.opportunities?.total_amount)}`}/>
        <StatCard icon="💰" iconBg="bg-emerald-50" title="本月回款" value={fmt.wan(s.payments?.this_month)} sub={`累计 ${fmt.wan(s.payments?.total_confirmed)}`}/>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📄" iconBg="bg-indigo-50" title="签约合同" value={s.contracts?.total??0} sub={`本月 ${s.contracts?.this_month??0} 份`}/>
        <StatCard icon="📁" iconBg="bg-rose-50" title="进行中项目" value={s.projects?.in_progress??0} sub={`逾期 ${s.projects?.overdue??0} 个`}/>
        <StatCard icon="⚠️" iconBg="bg-red-50" title="逾期回款节点" value={s.payment_plans?.overdue??0} sub={`逾期金额 ${fmt.wan(s.payment_plans?.overdue_amount)}`}/>
        <StatCard icon="📅" iconBg="bg-orange-50" title="30天内到期节点" value={s.payment_plans?.due_soon??0} sub="需及时跟进"/>
      </div>

      {alerts.length>0&&<div className="card">
        <div className="card-header"><span className="font-semibold text-gray-700">⚠️ 回款预警（近30天）</span><button className="btn-secondary btn-sm" onClick={()=>navigate('/payments')}>查看全部</button></div>
        <div className="card-body pt-0">
          <div className="space-y-2">
            {alerts.map(a=>(
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border ${a.days_until<0?'bg-red-50 border-red-200':a.days_until<=7?'bg-orange-50 border-orange-200':'bg-yellow-50 border-yellow-200'}`}>
                <span className="text-lg">{a.days_until<0?'🔴':a.days_until<=7?'🟠':'🟡'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{a.contract_name}</div>
                  <div className="text-xs text-gray-500">{a.customer_name} · {fmt.date(a.planned_date)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold">{fmt.yuan(a.amount)}</div>
                  <div className={`text-xs font-medium ${a.days_until<0?'text-red-600':'text-orange-600'}`}>{a.days_until<0?`逾期${Math.abs(a.days_until)}天`:`${a.days_until}天后到期`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header"><span className="font-semibold text-gray-700">回款趋势（近12月，万元）</span></div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend}>
                <defs><linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                <XAxis dataKey="month" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/>
                <Tooltip formatter={v=>[`${v}万`,'回款金额']}/>
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="url(#payGrad)" strokeWidth={2} dot={{r:3,fill:'#3b82f6'}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="font-semibold text-gray-700">客户行业分布</span></div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={industry} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="count" nameKey="industry">
                  {industry.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip/><Legend iconType="circle" iconSize={8} formatter={v=><span style={{fontSize:11}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-header"><span className="font-semibold text-gray-700">销售漏斗</span></div>
          <div className="p-4 space-y-2">
            {funnel.map((item,i)=>{const max=funnel[0]?.count||1;const pct=Math.round(item.count/max*100);return(
              <div key={item.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">{item.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div className="h-full rounded-full flex items-center pl-2 text-white text-xs font-medium" style={{width:`${Math.max(pct,15)}%`,background:COLORS[i%COLORS.length],transition:'width 0.8s ease'}}>{item.count}</div>
                </div>
                <span className="text-xs text-gray-400 w-12 text-right">{fmt.wan(item.amount)}</span>
              </div>
            )})}
          </div>
        </div>
        <div className="card lg:col-span-2">
          <div className="card-header"><span className="font-semibold text-gray-700">员工业绩排行（前5名）</span></div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={performance.map(p=>({...p,won_amount:(p.won_amount||0)/10000,payment_amount:(p.payment_amount||0)/10000}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                <XAxis dataKey="name" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/>
                <Tooltip formatter={v=>[`${v}万`]}/>
                <Legend iconSize={10} formatter={v=>v==='won_amount'?'赢单金额(万)':'回款金额(万)'}/>
                <Bar dataKey="won_amount" fill="#3b82f6" radius={[3,3,0,0]}/>
                <Bar dataKey="payment_amount" fill="#10b981" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="font-semibold text-gray-700">快捷入口</span></div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[{icon:'🎯',label:'新建线索',path:'/leads'},{icon:'👥',label:'新建客户',path:'/customers'},{icon:'💡',label:'新建商机',path:'/opportunities'},{icon:'📁',label:'项目管理',path:'/projects'},{icon:'📄',label:'新建合同',path:'/contracts'},{icon:'💰',label:'登记回款',path:'/payments'},{icon:'📈',label:'查看报表',path:'/reports'},{icon:'🔄',label:'离职移交',path:'/system/transfer'}].map(q=>(
              <button key={q.path} onClick={()=>navigate(q.path)} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-blue-50 transition-colors group">
                <span className="text-2xl group-hover:scale-110 transition-transform">{q.icon}</span>
                <span className="text-xs text-gray-600 group-hover:text-blue-600">{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
