import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, dateFmt, today, isOverdue } from '../lib/format'
import { Badge, Field, Modal, Pager, DataTable, usePaged, useOptions, useToast, Toast } from '../components/ui'
import InvoiceView from '../components/InvoiceView'

function ManualInvoiceForm({ onClose, onSaved }) {
  const customers = useOptions('profiles', 'email', 'full_name', (q) => q.eq('role', 'customer'))
  const products = useOptions('products', 'name', 'sales_price', (q) => q.eq('active', true))
  const taxes = useOptions('taxes', 'name', 'rate_percent', (q) => q.eq('active', true))
  const [f, setF] = useState({ customer_id: '', issue_date: today(), due_date: today() })
  const [lines, setLines] = useState([{ description: '', quantity: 1, unit_price: 0, tax_id: '' }])
  const [error, setError] = useState('')
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0)
  const tax = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0) * Number(taxes.find((t) => t.id === line.tax_id)?.rate_percent || 0) / 100, 0)
  async function save(e) {
    e.preventDefault()
    const { data, error: err } = await supabase.rpc('create_manual_invoice', { p_invoice: f, p_lines: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unit_price: Number(line.unit_price), tax_id: line.tax_id || null })) })
    if (err) return setError(err.message)
    onSaved(data); onClose()
  }
  return <Modal title="Create manual invoice" onClose={onClose} wide><form onSubmit={save}>
    <div className="form-grid cols2"><Field label="Customer *"><select required value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })}><option value="">Choose customer</option>{customers.map((x) => <option key={x.id} value={x.id}>{x.full_name || x.email} · {x.email}</option>)}</select></Field><Field label="Invoice date"><input type="date" value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></Field><Field label="Due date"><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field></div>
    <h4>Invoice lines</h4>{lines.map((line, i) => <div className="line-row" key={i}><select onChange={(e) => { const product = products.find((p) => p.id === e.target.value); setLines(lines.map((l, n) => n === i ? { ...l, description: product?.name || '', unit_price: product?.sales_price || 0 } : l)) }}><option value="">Choose product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input placeholder="Description" value={line.description} onChange={(e) => setLines(lines.map((l, n) => n === i ? { ...l, description: e.target.value } : l))} required /><input type="number" min="1" value={line.quantity} onChange={(e) => setLines(lines.map((l, n) => n === i ? { ...l, quantity: e.target.value } : l))} title="Quantity" /><input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => setLines(lines.map((l, n) => n === i ? { ...l, unit_price: e.target.value } : l))} title="Unit price" /><select value={line.tax_id} onChange={(e) => setLines(lines.map((l, n) => n === i ? { ...l, tax_id: e.target.value } : l))}><option value="">No tax</option>{taxes.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.rate_percent}%</option>)}</select><button type="button" className="link danger" onClick={() => setLines(lines.filter((_, n) => n !== i))}>Remove</button></div>)}
    <button type="button" className="btn ghost" onClick={() => setLines([...lines, { description: '', quantity: 1, unit_price: 0, tax_id: '' }])}>+ Add line</button><p className="total-line">Subtotal {money(subtotal)} · Tax {money(tax)} · <b>Total {money(subtotal + tax)}</b></p>{error && <p className="err">{error}</p>}<div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn">Create draft invoice</button></div>
  </form></Modal>
}

export default function Invoices({ staff = true, initial = {} }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(initial.overdue ? 'overdue' : '')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, show] = useToast()
  const list = usePaged({
    table: 'invoices', select: '*, customer:profiles(full_name,email)', order: ['created_at', false],
    apply: (x) => {
      if (q) x = x.ilike('number', `%${q}%`)
      if (status === 'overdue') x = x.eq('status', 'confirmed').lt('due_date', today())
      else if (status === 'unpaid') x = x.eq('status', 'confirmed')
      else if (status) x = x.eq('status', status)
      return x
    }, deps: [q, status],
  })

  async function billing() {
    setBusy(true)
    const { data, error } = await supabase.rpc('run_billing')
    setBusy(false)
    if (error) return show(error.message, 'err')
    show(data ? `${data} invoice${data === 1 ? '' : 's'} generated (as drafts)` : 'Nothing due today.'); list.reload()
  }
  async function confirmAllDrafts() {
    const { error } = await supabase.from('invoices').update({ status: 'confirmed' }).eq('status', 'draft')
    if (error) return show(error.message, 'err')
    show('All drafts confirmed'); list.reload()
  }

  return (
    <div>
      <div className="page-head"><div><h1>{staff ? 'Invoices & billing' : 'My invoices'}</h1>
        <p>{staff ? 'Generated from subscriptions — never typed, never billed twice.' : 'Your invoices and payment status.'}</p></div>
        {staff && <div className="head-actions">
          <button className="btn ghost" onClick={() => setCreating(true)}>+ Manual invoice</button>
          <button className="btn ghost" onClick={confirmAllDrafts}>Confirm all drafts</button>
          <button className="btn" onClick={billing} disabled={busy}>{busy ? 'Billing…' : '⚡ Run billing'}</button></div>}
      </div>
      <div className="toolbar">
        <input placeholder="Search invoice number…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option><option value="draft">Draft</option><option value="confirmed">Confirmed</option>
          <option value="unpaid">Unpaid (outstanding)</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      <DataTable rows={list.rows} loading={list.loading} onRow={setOpen} cols={[
        { label: 'Invoice', render: (r) => <b>{r.number}</b> },
        ...(staff ? [{ label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email }] : []),
        { label: 'Issued', render: (r) => dateFmt(r.issue_date) },
        { label: 'Due', render: (r) => dateFmt(r.due_date) },
        { label: 'Total', right: true, render: (r) => money(r.total) },
        { label: 'Balance', right: true, render: (r) => money(r.total - r.amount_paid) },
        { label: 'Status', render: (r) => isOverdue(r) ? <Badge value="overdue" tone="bad" /> : <Badge value={r.status} /> },
      ]} />
      <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
      {open && <InvoiceView invoice={open} staff={staff} onClose={() => setOpen(null)} onChanged={list.reload} />}
      {creating && <ManualInvoiceForm onClose={() => setCreating(false)} onSaved={() => { show('Draft invoice created'); list.reload() }} />}
      <Toast toast={toast} />
    </div>
  )
}
