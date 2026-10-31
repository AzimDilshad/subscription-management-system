import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { money, dateFmt, today } from '../lib/format'
import { Badge, Modal, Field, Pager, DataTable, usePaged, useOptions, useToast, Toast } from '../components/ui'

const FLOW = ['draft', 'quotation', 'confirmed', 'active', 'closed']
const NEXT_LABEL = { draft: 'Send as quotation', quotation: 'Confirm', confirmed: 'Activate' }

function Stepper({ status }) {
  const at = FLOW.indexOf(status)
  return (
    <div className="stepper">
      {FLOW.map((s, i) => <span key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>{s}</span>)}
    </div>
  )
}

function Detail({ sub, onClose, onChanged }) {
  const [lines, setLines] = useState([])
  const [invoices, setInvoices] = useState([])
  const [toast, show] = useToast()
  const load = async () => {
    const [l, i] = await Promise.all([
      supabase.from('subscription_lines').select('*, product:products(name), variant:product_variants(attribute,value), tax:taxes(name,rate_percent)').eq('subscription_id', sub.id),
      supabase.from('invoices').select('id,number,status,total,period_start,period_end').eq('subscription_id', sub.id).order('period_start', { ascending: false }).limit(12),
    ])
    setLines(l.data || []); setInvoices(i.data || [])
  }
  useEffect(() => { load() }, [sub.id]) // eslint-disable-line

  async function move(status) {
    const changes = { status }
    if (status === 'paused') { changes.paused_at = new Date().toISOString(); changes.paused_next_billing_date = sub.next_billing_date }
    if (status === 'active' && sub.status === 'paused') {
      const elapsed = sub.paused_at ? Math.max(0, Math.floor((Date.now() - new Date(sub.paused_at).getTime()) / 86400000)) : 0
      const base = sub.paused_next_billing_date || today()
      const next = new Date(`${base}T00:00:00`); next.setDate(next.getDate() + elapsed); changes.next_billing_date = next.toISOString().slice(0, 10); changes.paused_at = null; changes.paused_next_billing_date = null
    }
    const { error } = await supabase.from('subscriptions').update(changes).eq('id', sub.id)
    if (error) return show(error.message, 'err')
    onChanged(); onClose()
  }
  async function billNow() {
    const { data, error } = await supabase.rpc('generate_invoice', { p_sub: sub.id })
    if (error) return show(error.message, 'err')
    show(data ? 'Invoice created' : 'Already billed for this period'); load(); onChanged()
  }
  const total = lines.reduce((a, l) => a + l.quantity * l.unit_price, 0)
  const next = NEXT_LABEL[sub.status]

  return (
    <Modal title={`${sub.number} — ${sub.customer?.full_name || sub.customer?.email}`} onClose={onClose} wide>
      <Stepper status={sub.status} />
      <div className="meta">
        <div><span>Plan</span>{sub.plan?.name} ({sub.plan?.billing_period})</div>
        <div><span>Status</span><Badge value={sub.status} /></div>
        <div><span>Start</span>{dateFmt(sub.start_date)}</div>
        <div><span>Expiry</span>{dateFmt(sub.expiry_date)}</div>
        <div><span>Terms</span>Net {sub.payment_terms_days} days</div>
        <div><span>Next billing</span>{dateFmt(sub.next_billing_date)}</div>
      </div>
      <table className="tbl"><thead><tr><th>Product</th><th className="r">Qty</th><th className="r">Unit price</th><th>Tax</th><th className="r">Amount</th></tr></thead>
        <tbody>{lines.map((l) => (
          <tr key={l.id}><td>{l.product?.name}{l.variant && ` (${l.variant.value})`}</td><td className="r">{l.quantity}</td>
            <td className="r">{money(l.unit_price)}</td><td>{l.tax ? l.tax.name : '—'}</td><td className="r">{money(l.quantity * l.unit_price)}</td></tr>
        ))}
          <tr className="sum"><td colSpan="4" className="r">Subtotal per period</td><td className="r">{money(total)}</td></tr></tbody></table>
      {invoices.length > 0 && <>
        <h4>Invoices</h4>
        <div className="chips">{invoices.map((i) => <span key={i.id} className="chip">{i.number} · {dateFmt(i.period_start)} · {money(i.total)} · <Badge value={i.status} /></span>)}</div></>}
      <div className="form-actions">
        {sub.status === 'active' && <button className="btn ghost" onClick={billNow}>Bill current period</button>}
        {sub.status === 'active' && sub.plan?.can_pause && <button className="btn ghost" onClick={() => move('paused')}>Pause</button>}
        {sub.status === 'paused' && <button className="btn" onClick={() => move('active')}>Resume</button>}
        {sub.status !== 'closed' && sub.plan?.can_close && sub.status !== 'draft' && <button className="btn danger-btn" onClick={() => move('closed')}>Close</button>}
        {next && <button className="btn" onClick={() => move(FLOW[FLOW.indexOf(sub.status) + 1])}>{next} →</button>}
      </div>
      <Toast toast={toast} />
    </Modal>
  )
}

function Create({ onClose, onSaved }) {
  const { session } = useAuth()
  const customers = useOptions('profiles', 'full_name', 'email', (q) => q.eq('role', 'customer'))
  const plans = useOptions('plans', 'name', 'price, product_id, min_quantity', (q) => q.eq('active', true))
  const templates = useOptions('quotation_templates', 'name', 'plan_id, validity_days, lines')
  const products = useOptions('products', 'name', 'sales_price')
  const taxes = useOptions('taxes', 'name', 'rate_percent', (q) => q.eq('active', true))
  const [f, setF] = useState({ customer_id: '', plan_id: '', template_id: '', start_date: today(), expiry_date: '', payment_terms_days: 15 })
  const [lines, setLines] = useState([])
  const [variants, setVariants] = useState({})
  const [err, setErr] = useState('')

  const loadVariants = async (pid) => {
    if (!pid || variants[pid]) return
    const { data } = await supabase.from('product_variants').select('*').eq('product_id', pid)
    setVariants((v) => ({ ...v, [pid]: data || [] }))
  }
  function applyTemplate(id) {
    const t = templates.find((x) => x.id === id)
    if (!t) return setF({ ...f, template_id: '' })
    const exp = new Date(); exp.setDate(exp.getDate() + (t.validity_days || 30))
    setF({ ...f, template_id: id, plan_id: t.plan_id || f.plan_id, expiry_date: exp.toISOString().slice(0, 10) })
    setLines((t.lines || []).map((l) => {
      const p = products.find((x) => x.id === l.product_id)
      loadVariants(l.product_id)
      return { product_id: l.product_id, variant_id: '', quantity: l.quantity || 1, unit_price: p?.sales_price || 0, tax_id: '' }
    }))
  }
  function applyPlan(id) {
    const p = plans.find((x) => x.id === id)
    setF({ ...f, plan_id: id })
    if (p && lines.length === 0 && p.product_id) { loadVariants(p.product_id); setLines([{ product_id: p.product_id, variant_id: '', quantity: p.min_quantity || 1, unit_price: p.price, tax_id: '' }]) }
  }
  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  function pickProduct(i, pid) {
    const p = products.find((x) => x.id === pid); loadVariants(pid)
    setLine(i, { product_id: pid, variant_id: '', unit_price: p?.sales_price || 0 })
  }
  function pickVariant(i, vid) {
    const l = lines[i]; const v = (variants[l.product_id] || []).find((x) => x.id === vid)
    const base = products.find((x) => x.id === l.product_id)?.sales_price || 0
    setLine(i, { variant_id: vid, unit_price: Number(base) + Number(v?.extra_price || 0) })   // Odoo brand adds 560
  }
  const total = lines.reduce((a, l) => a + l.quantity * l.unit_price, 0)

  async function save(e) {
    e.preventDefault()
    if (!lines.length) return setErr('Add at least one product line.')
    const plan = plans.find((p) => p.id === f.plan_id)
    if (plan && lines.some((l) => l.quantity < plan.min_quantity)) return setErr(`This plan needs a minimum quantity of ${plan.min_quantity}.`)
    const { data, error } = await supabase.from('subscriptions').insert({
      customer_id: f.customer_id, plan_id: f.plan_id, template_id: f.template_id || null,
      start_date: f.start_date, expiry_date: f.expiry_date || null,
      payment_terms_days: Number(f.payment_terms_days), created_by: session.user.id,
    }).select().single()
    if (error) return setErr(error.message)
    const { error: e2 } = await supabase.from('subscription_lines').insert(
      lines.map((l) => ({ subscription_id: data.id, product_id: l.product_id, variant_id: l.variant_id || null, quantity: Number(l.quantity), unit_price: Number(l.unit_price), tax_id: l.tax_id || null })))
    if (e2) return setErr(e2.message)
    onSaved(); onClose()
  }

  return (
    <Modal title="New subscription" onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="form-grid cols2">
          <Field label="Start from template"><select value={f.template_id} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— blank —</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Customer *"><select required value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })}>
            <option value="">Select…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.email})</option>)}</select></Field>
          <Field label="Plan *"><select required value={f.plan_id} onChange={(e) => applyPlan(e.target.value)}>
            <option value="">Select…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</select></Field>
          <Field label="Payment terms (days)"><input type="number" min="0" value={f.payment_terms_days} onChange={(e) => setF({ ...f, payment_terms_days: e.target.value })} /></Field>
          <Field label="Start date *"><input type="date" required value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="Expiry date"><input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></Field>
        </div>
        <h4>Lines</h4>
        {lines.map((l, i) => (
          <div className="line-row" key={i}>
            <select required value={l.product_id} onChange={(e) => pickProduct(i, e.target.value)}><option value="">Product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select value={l.variant_id} onChange={(e) => pickVariant(i, e.target.value)} disabled={!(variants[l.product_id] || []).length}>
              <option value="">No variant</option>{(variants[l.product_id] || []).map((v) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{v.extra_price})</option>)}</select>
            <input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} title="Quantity" />
            <input type="number" step="0.01" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} title="Unit price" />
            <select value={l.tax_id} onChange={(e) => setLine(i, { tax_id: e.target.value })}><option value="">No tax</option>{taxes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <button type="button" className="link danger" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={() => setLines([...lines, { product_id: '', variant_id: '', quantity: 1, unit_price: 0, tax_id: '' }])}>+ Add line</button>
        <p className="total-line">Subtotal per billing period: <b>{money(total)}</b> <small>(taxes & discounts are added on the invoice)</small></p>
        {err && <p className="err">{err}</p>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn">Create (Draft)</button></div>
      </form>
    </Modal>
  )
}

export default function Subscriptions() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [toast, show] = useToast()
  const list = usePaged({
    table: 'subscriptions', select: '*, customer:profiles!subscriptions_customer_id_fkey(full_name,email), plan:plans(name,billing_period,can_close,can_pause)',
    apply: (x) => { if (q) x = x.ilike('number', `%${q}%`); if (status) x = x.eq('status', status); return x }, deps: [q, status],
  })
  return (
    <div>
      <div className="page-head"><div><h1>Subscriptions</h1><p>Draft → Quotation → Confirmed → Active → Closed</p></div>
        <button className="btn" onClick={() => setCreating(true)}>+ New subscription</button></div>
      <div className="toolbar">
        <input placeholder="Search by number (SUB-…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{FLOW.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {list.error && <p className="err">Could not load subscriptions: {list.error.message}</p>}
      <DataTable rows={list.rows} loading={list.loading} onRow={setOpen} cols={[
        { label: 'Number', render: (r) => <b>{r.number}</b> },
        { label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email },
        { label: 'Plan', render: (r) => r.plan?.name },
        { label: 'Start', render: (r) => dateFmt(r.start_date) },
        { label: 'Expiry', render: (r) => dateFmt(r.expiry_date) },
        { label: 'Next billing', render: (r) => dateFmt(r.next_billing_date) },
        { label: 'Status', render: (r) => <Badge value={r.status} /> },
      ]} />
      <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
      {open && <Detail sub={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
      {creating && <Create onClose={() => setCreating(false)} onSaved={() => { show('Subscription created'); list.setPage(0); list.reload() }} />}
      <Toast toast={toast} />
    </div>
  )
}
