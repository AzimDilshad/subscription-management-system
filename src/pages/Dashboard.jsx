import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { money, dateFmt, today } from '../lib/format'
import { Badge, useToast, Toast } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const COLORS = { draft: '#a7a3bd', quotation: '#f5a623', confirmed: '#3b82f6', active: '#12b76a', closed: '#ef4444' }

function Stat({ label, value, sub, tone, onClick }) {
  return (
    <button className={'stat ' + (tone || '')} onClick={onClick}>
      <span>{label}</span><strong>{value}</strong>{sub && <em>{sub}</em>}
    </button>
  )
}

export default function Dashboard({ go }) {
  const { isAdmin } = useAuth()
  const [from, setFrom] = useState(new Date().getFullYear() + '-01-01')
  const [to, setTo] = useState(today())
  const [s, setS] = useState(null)
  const [overdue, setOverdue] = useState([])
  const [counts, setCounts] = useState({})
  const [busy, setBusy] = useState(false)
  const [toast, show] = useToast()

  async function load() {
    const [stats, od] = await Promise.all([
      supabase.rpc('dashboard_stats', { p_from: from, p_to: to }),
      supabase.from('invoices').select('id, number, due_date, total, amount_paid, customer:profiles(full_name,email)')
        .eq('status', 'confirmed').lt('due_date', today()).order('due_date').limit(6),
    ])
    const tables = ['profiles', 'products', 'plans', 'invoices']
    const totals = await Promise.all(tables.map((table) => supabase.from(table).select('*', { count: 'exact', head: true })))
    setCounts(Object.fromEntries(tables.map((table, index) => [table, totals[index].count || 0])))
    if (stats.error) show(stats.error.message, 'err'); else setS(stats.data)
    setOverdue(od.data || [])
  }
  useEffect(() => { load() }, [from, to]) // eslint-disable-line

  async function runBilling() {
    setBusy(true)
    const { data, error } = await supabase.rpc('run_billing')
    setBusy(false)
    if (error) return show(error.message, 'err')
    show(data === 0 ? 'Nothing due — every subscription is up to date.' : `${data} invoice${data === 1 ? '' : 's'} created.`)
    load()
  }

  if (!s) return <div className="muted pad">Loading dashboard…<Toast toast={toast} /></div>

  return (
    <div>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Subscriptions, revenue and collections at a glance.</p></div>
        <div className="head-actions">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={runBilling} disabled={busy}>{busy ? 'Billing…' : '⚡ Run billing now'}</button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Customers" value={counts.profiles ?? '—'} onClick={() => go('users')} />
        <Stat label="Products" value={counts.products ?? '—'} onClick={() => go('products')} />
        <Stat label="Subscription plans" value={counts.plans ?? '—'} onClick={() => go('plans')} />
        <Stat label="Active subscriptions" value={s.active_subscriptions} sub={`of ${s.total_subscriptions} total`} onClick={() => go('subscriptions')} />
        <Stat label="Monthly recurring revenue" value={money(s.mrr)} sub="from active subscriptions" />
        <Stat label="Revenue collected" value={money(s.revenue)} sub={`${dateFmt(from)} – ${dateFmt(to)}`} tone="good" onClick={() => go('payments')} />
        <Stat label="Outstanding" value={money(s.outstanding)} sub="confirmed, unpaid" tone="warn" onClick={() => go('invoices')} />
        <Stat label="Overdue invoices" value={s.overdue_count} sub={money(s.overdue_amount)} tone="bad" onClick={() => go('invoices', { overdue: true })} />
        <Stat label="Invoices" value={counts.invoices ?? '—'} onClick={() => go('invoices')} />
        <Stat label="Annual recurring revenue" value={money(Number(s.mrr || 0) * 12)} sub="annualized MRR" />
      </div>

      <div className="card">
        <h3>Quick actions</h3>
        <div className="head-actions">
          <button className="btn ghost" onClick={() => go('users')}>Customers</button>
          {isAdmin && <button className="btn ghost" onClick={() => go('products')}>Add product</button>}
          {isAdmin && <button className="btn ghost" onClick={() => go('plans')}>Add plan</button>}
          <button className="btn ghost" onClick={() => go('quotes')}>Create quotation</button>
          <button className="btn ghost" onClick={() => go('subscriptions')}>Create subscription</button>
          <button className="btn ghost" onClick={() => go('invoices')}>Generate invoices</button>
          <button className="btn ghost" onClick={() => go('payments')}>Record payment</button>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Revenue by month</h3>
          {s.monthly_revenue.length === 0 ? <p className="muted">No payments in this range.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={s.monthly_revenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} width={60} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="revenue" fill="#6338e8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h3>Subscriptions by status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={s.status_counts} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}
                label={({ status, count }) => `${status} ${count}`}>
                {s.status_counts.map((e) => <Cell key={e.status} fill={COLORS[e.status]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Overdue invoices</h3><button className="link" onClick={() => go('invoices', { overdue: true })}>View all →</button></div>
        {overdue.length === 0 ? <p className="muted">🎉 Nothing overdue.</p> : (
          <table className="tbl"><thead><tr><th>Invoice</th><th>Customer</th><th>Due</th><th className="r">Balance</th></tr></thead>
            <tbody>{overdue.map((i) => (
              <tr key={i.id}><td>{i.number}</td><td>{i.customer?.full_name || i.customer?.email}</td>
                <td><Badge value={dateFmt(i.due_date)} tone="bad" /></td><td className="r">{money(i.total - i.amount_paid)}</td></tr>
            ))}</tbody></table>
        )}
      </div>
      <Toast toast={toast} />
    </div>
  )
}
