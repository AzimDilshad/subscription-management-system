import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DataTable, Pager, Toast, usePaged, useToast } from '../components/ui'
import { dateFmt } from '../lib/format'

export default function AutomationCenter() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [toast, show] = useToast()
  const list = usePaged({ table: 'automation_runs', order: ['created_at', false] })
  async function run() {
    setBusy(true); setResult(null)
    const { data, error } = await supabase.rpc('run_business_automations')
    setBusy(false)
    if (error) return show(error.message, 'err')
    setResult(data); show('Automation run completed'); list.reload()
  }
  return <div>
    <div className="page-head"><div><h1>Automation</h1><p>Run supported billing and reminder jobs. Configure a server scheduler for automatic execution.</p></div><button className="btn" disabled={busy} onClick={run}>{busy ? 'Running…' : 'Run automations now'}</button></div>
    <div className="stats"><div className="stat"><span>Recurring billing</span><strong>Enabled on run</strong><em>Creates every due invoice period safely</em></div><div className="stat"><span>Plan expiry rules</span><strong>Enabled on run</strong><em>Closes active subscriptions for expired auto-close plans</em></div><div className="stat"><span>Invoice reminders</span><strong>In-app queue</strong><em>One overdue reminder per invoice each day</em></div><div className="stat"><span>Quotation expiry</span><strong>Enabled on run</strong><em>Marks past-validity drafts and sent quotes expired</em></div></div>
    {result && <div className="card"><b>Last run</b><p>Invoices created: {result.invoices_created} · Quotes expired: {result.quotes_expired} · Subscriptions closed: {result.subscriptions_closed} · Reminders queued: {result.reminders_queued}</p></div>}
    <h3>Run history</h3><DataTable rows={list.rows} loading={list.loading} cols={[{ label: 'Started', render: (r) => dateFmt(r.started_at || r.created_at) }, { label: 'Status', key: 'status' }, { label: 'Summary', render: (r) => JSON.stringify(r.output || r.error || {}) }]} /><Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
    <p className="muted">To run these jobs on a schedule, enable Supabase pg_cron and schedule <code>select run_business_automations()</code>. Email, SMS and gateway actions need a server-side provider.</p>
    <Toast toast={toast} />
  </div>
}
