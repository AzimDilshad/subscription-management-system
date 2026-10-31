import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, today } from '../lib/format'
import { useToast, Toast } from '../components/ui'

const REPORTS = {
  payments: { label: 'Payments', table: 'payments', columns: ['paid_on', 'amount', 'method', 'note', 'invoice_id'] },
  invoices: { label: 'Invoices', table: 'invoices', columns: ['number', 'issue_date', 'due_date', 'status', 'subtotal', 'tax_total', 'total', 'amount_paid', 'customer_id'] },
  subscriptions: { label: 'Subscriptions', table: 'subscriptions', columns: ['number', 'status', 'start_date', 'expiry_date', 'next_billing_date', 'customer_id', 'plan_id'] },
  customers: { label: 'Customers', table: 'profiles', columns: ['full_name', 'email', 'phone', 'company_name', 'gstin', 'customer_status', 'created_at'] },
}

const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function Reports() {
  const [kind, setKind] = useState('payments')
  const [from, setFrom] = useState(new Date().getFullYear() + '-01-01')
  const [to, setTo] = useState(today())
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState([])
  const [toast, show] = useToast()
  async function load() {
    setBusy(true)
    const report = REPORTS[kind]
    let page = 0; let result = []; let error = null
    while (page < 20) {
      let query = supabase.from(report.table).select(report.columns.join(','))
      if (kind === 'payments') query = query.gte('paid_on', from).lte('paid_on', to).order('paid_on')
      if (kind === 'invoices') query = query.gte('issue_date', from).lte('issue_date', to).order('issue_date')
      if (kind === 'subscriptions') query = query.gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).order('created_at')
      if (kind === 'customers') query = query.eq('role', 'customer').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).order('created_at')
      const res = await query.range(page * 500, page * 500 + 499)
      if (res.error) { error = res.error; break }
      result = [...result, ...(res.data || [])]
      if ((res.data || []).length < 500) break
      page += 1
    }
    setBusy(false)
    if (error) return show(error.message, 'err')
    setRows(result)
    show(`${result.length} rows loaded${result.length >= 10000 ? ' (export capped at 10,000)' : ''}`)
  }
  function download() {
    const cols = REPORTS[kind].columns
    const contents = [cols.map(csv).join(','), ...rows.map((r) => cols.map((c) => csv(r[c])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `brightloop-${kind}-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const total = kind === 'payments' ? rows.reduce((n, r) => n + Number(r.amount || 0), 0) : kind === 'invoices' ? rows.reduce((n, r) => n + Number(r.total || 0), 0) : null
  return <div>
    <div className="page-head"><div><h1>Reports & analytics</h1><p>Filter financial and customer records, export CSV, or print the report.</p></div><button className="btn ghost" onClick={() => window.print()}>Print / Save PDF</button></div>
    <div className="toolbar"><select value={kind} onChange={(e) => { setKind(e.target.value); setRows([]) }}>{Object.entries(REPORTS).map(([key, report]) => <option key={key} value={key}>{report.label}</option>)}</select><input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>to</span><input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /><button className="btn" disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Run report'}</button>{rows.length > 0 && <button className="btn ghost" onClick={download}>Export CSV / Excel</button>}</div>
    {rows.length > 0 && <div className="card"><b>{rows.length} records</b>{total !== null && <span> · Total {money(total)}</span>}</div>}
    <div className="tbl-wrap"><table className="tbl"><thead><tr>{(REPORTS[kind].columns).map((c) => <th key={c}>{c.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{REPORTS[kind].columns.map((c) => <td key={c}>{r[c] ?? '—'}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={REPORTS[kind].columns.length} className="muted">Choose a report and run it to view results.</td></tr>}</tbody></table></div>
    <Toast toast={toast} />
  </div>
}
