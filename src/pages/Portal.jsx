import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { money, dateFmt } from '../lib/format'
import { Badge, DataTable, Field, Modal, Pager, usePaged, useToast, Toast } from '../components/ui'
import Invoices from './Invoices'

export function MySubscriptions() {
  const [toast, show] = useToast()
  const list = usePaged({ table: 'subscriptions', select: '*, plan:plans(name,billing_period,price,can_close,can_pause)' })
  async function close(id) {
    if (!window.confirm('Close this subscription?')) return
    const { error } = await supabase.rpc('close_my_subscription', { p_sub: id })
    if (error) return show(error.message, 'err')
    show('Subscription closed'); list.reload()
  }
  async function togglePause(row) {
    const rpc = row.status === 'paused' ? 'resume_my_subscription' : 'pause_my_subscription'
    const { error } = await supabase.rpc(rpc, { p_sub: row.id })
    if (error) return show(error.message, 'err')
    show(row.status === 'paused' ? 'Subscription resumed' : 'Subscription paused'); list.reload()
  }
  return (
    <div>
      <div className="page-head"><div><h1>My subscriptions</h1><p>Everything you subscribe to, in one place.</p></div></div>
      <DataTable rows={list.rows} loading={list.loading} empty="You have no subscriptions yet — browse the plans to get started." cols={[
        { label: 'Number', render: (r) => <b>{r.number}</b> }, { label: 'Plan', render: (r) => r.plan?.name },
        { label: 'Billing', render: (r) => r.plan?.billing_period }, { label: 'Next billing', render: (r) => dateFmt(r.next_billing_date) },
        { label: 'Expires', render: (r) => dateFmt(r.expiry_date) }, { label: 'Status', render: (r) => <Badge value={r.status} /> },
        { label: '', right: true, render: (r) => <span className="row-actions">{r.status === 'active' && r.plan?.can_pause && <button onClick={() => togglePause(r)}>Pause</button>}{r.status === 'paused' && <button onClick={() => togglePause(r)}>Resume</button>}{['confirmed', 'active'].includes(r.status) && r.plan?.can_close && <button className="danger" onClick={() => close(r.id)}>Close</button>}</span> },
      ]} />
      <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
      <Toast toast={toast} />
    </div>
  )
}

export function BrowsePlans({ go }) {
  const [toast, show] = useToast()
  const list = usePaged({ table: 'plans', select: '*, product:products(name,notes)', apply: (q) => q.eq('active', true), order: ['name', true] })
  async function subscribe(p) {
    const { error } = await supabase.rpc('subscribe_to_plan', { p_plan: p.id, p_qty: p.min_quantity })
    if (error) return show(error.message, 'err')
    show('Requested! Our team will confirm your quotation.'); setTimeout(() => go('subscriptions'), 900)
  }
  return (
    <div>
      <div className="page-head"><div><h1>Available plans</h1><p>Pick a plan and we'll prepare your quotation.</p></div></div>
      <div className="plan-grid">
        {list.rows.map((p) => (
          <div className="card plan" key={p.id}>
            <Badge value={p.billing_period} tone="blue" />
            <h3>{p.name}</h3><p className="muted">{p.product?.name}</p>
            <div className="price">{money(p.price)}<small> / {p.billing_period.replace('ly', '')}</small></div>
            <p className="muted">Minimum quantity: {p.min_quantity}</p>
            <button className="btn" onClick={() => subscribe(p)}>Subscribe</button>
          </div>
        ))}
        {!list.loading && list.rows.length === 0 && <p className="muted">No plans are available right now.</p>}
      </div>
      <Toast toast={toast} />
    </div>
  )
}

export const MyInvoices = () => <Invoices staff={false} />

export function MyQuotations() {
  const [open, setOpen] = useState(null)
  const [items, setItems] = useState([])
  const [toast, show] = useToast()
  const list = usePaged({ table: 'quotations', select: '*', order: ['created_at', false] })
  useEffect(() => {
    if (!open) { setItems([]); return }
    supabase.from('quotation_items').select('*, product:products(name)').eq('quotation_id', open.id).then(({ data }) => setItems(data || []))
  }, [open?.id])
  async function accept(id) {
    const { error } = await supabase.rpc('accept_my_quotation', { p_quote: id })
    if (error) return show(error.message, 'err')
    show('Quotation accepted. Our team will prepare your subscription.'); list.reload(); setOpen(null)
  }
  return <div><div className="page-head"><div><h1>My quotations</h1><p>Review the proposed products and pricing, then accept a quote.</p></div></div>
    <DataTable rows={list.rows} loading={list.loading} onRow={setOpen} cols={[{ label: 'Quotation', render: (r) => <b>{r.number}</b> }, { label: 'Valid until', render: (r) => dateFmt(r.valid_until) }, { label: 'Total', right: true, render: (r) => money(r.total) }, { label: 'Status', render: (r) => <Badge value={r.status} /> }]} />
    <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
    {open && <Modal title={`Quotation ${open.number}`} onClose={() => setOpen(null)} wide><table className="tbl"><thead><tr><th>Item</th><th>Description</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Tax</th></tr></thead><tbody>{items.map((x) => <tr key={x.id}><td>{x.product?.name || '—'}</td><td>{x.description}</td><td className="r">{x.quantity}</td><td className="r">{money(x.unit_price)}</td><td className="r">{x.tax_rate}%</td></tr>)}</tbody></table><p className="total-line">Total: <b>{money(open.total)}</b></p>{open.status === 'sent' && <div className="form-actions"><button className="btn" onClick={() => accept(open.id)}>Accept quotation</button></div>}</Modal>}
    <Toast toast={toast} />
  </div>
}

export function MyProfile() {
  const { profile } = useAuth()
  const [form, setForm] = useState({ full_name: '', phone: '', company_name: '', gstin: '', notification_preferences: {} })
  const [addresses, setAddresses] = useState([])
  const [adding, setAdding] = useState(false)
  const [address, setAddress] = useState({ address_type: 'billing', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'India' })
  const [toast, show] = useToast()
  async function load() {
    const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', profile.id).order('created_at')
    setAddresses(data || [])
  }
  useEffect(() => { setForm({ full_name: profile.full_name || '', phone: profile.phone || '', company_name: profile.company_name || '', gstin: profile.gstin || '', notification_preferences: profile.notification_preferences || {} }); load() }, [profile.id]) // eslint-disable-line
  async function save(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update(form).eq('id', profile.id)
    if (error) return show(error.message, 'err')
    show('Profile updated')
  }
  async function addAddress(e) {
    e.preventDefault()
    const { error } = await supabase.from('customer_addresses').insert({ ...address, customer_id: profile.id })
    if (error) return show(error.message, 'err')
    setAdding(false); show('Address saved'); load()
  }
  async function removeAddress(id) {
    const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
    if (error) show(error.message, 'err'); else load()
  }
  return <div><div className="page-head"><div><h1>My profile</h1><p>Update contact and business details used on invoices.</p></div></div>
    <div className="card"><form className="form-grid cols2" onSubmit={save}><Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field><Field label="Email"><input value={profile.email} disabled /></Field><Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Company"><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field><Field label="GSTIN"><input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field><Field label="Email billing reminders"><input type="checkbox" checked={form.notification_preferences?.billing_reminders !== false} onChange={(e) => setForm({ ...form, notification_preferences: { ...form.notification_preferences, billing_reminders: e.target.checked } })} /></Field><Field label="Email subscription updates"><input type="checkbox" checked={form.notification_preferences?.subscription_updates !== false} onChange={(e) => setForm({ ...form, notification_preferences: { ...form.notification_preferences, subscription_updates: e.target.checked } })} /></Field><div className="form-actions"><button className="btn">Save profile</button></div></form></div>
    <div className="card"><div className="card-head"><h3>Addresses</h3><button className="btn ghost" onClick={() => setAdding(true)}>+ Add address</button></div>{addresses.map((a) => <div className="meta" key={a.id}><div><span>{a.address_type}</span>{a.line1} {a.line2}</div><div><span>Location</span>{[a.city,a.state,a.postal_code,a.country].filter(Boolean).join(', ')}</div><button className="link danger" onClick={() => removeAddress(a.id)}>Remove</button></div>)}{!addresses.length && <p className="muted">No addresses saved yet.</p>}</div>
    {adding && <Modal title="Add address" onClose={() => setAdding(false)}><form className="form-grid" onSubmit={addAddress}><Field label="Type"><select value={address.address_type} onChange={(e) => setAddress({ ...address, address_type: e.target.value })}><option value="billing">Billing</option><option value="shipping">Shipping</option></select></Field>{['line1','line2','city','state','postal_code','country'].map((key) => <Field key={key} label={key.replace('_',' ')}><input required={key === 'line1'} value={address[key]} onChange={(e) => setAddress({ ...address, [key]: e.target.value })} /></Field>)}<div className="form-actions"><button className="btn">Save address</button></div></form></Modal>}
    <Toast toast={toast} />
  </div>
}

export function MyPayments() {
  const [open, setOpen] = useState(null)
  const list = usePaged({ table: 'payments', select: '*, invoice:invoices(number)', order: ['paid_on', false] })
  return <div><div className="page-head"><div><h1>Payment history</h1><p>Payments recorded against your invoices.</p></div></div><DataTable rows={list.rows} loading={list.loading} cols={[{ label: 'Date', render: (r) => dateFmt(r.paid_on) }, { label: 'Invoice', render: (r) => r.invoice?.number || '—' }, { label: 'Method', key: 'method' }, { label: 'Amount', right: true, render: (r) => money(r.amount) }, { label: 'Note', key: 'note' }, { label: '', right: true, render: (r) => <button className="link" onClick={() => setOpen(r)}>Receipt</button> }]} /><Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />{open && <Modal title="Payment receipt" onClose={() => setOpen(null)}><div className="print-area"><h2>Brightloop · Payment receipt</h2><p><b>Receipt reference</b><br />{open.id}</p><p><b>Invoice</b><br />{open.invoice?.number || '—'}</p><p><b>Date</b><br />{dateFmt(open.paid_on)}</p><p><b>Method</b><br />{open.method.replace('_', ' ')}</p><p><b>Amount received</b><br />{money(open.amount)}</p>{open.transaction_id && <p><b>Transaction reference</b><br />{open.transaction_id}</p>}</div><div className="form-actions"><button className="btn" onClick={() => window.print()}>Print / Save PDF</button></div></Modal>}</div>
}

export function MyNotifications() {
  const list = usePaged({ table: 'notifications', order: ['created_at', false] })
  return <div><div className="page-head"><div><h1>Notifications</h1><p>Billing and subscription updates for your account.</p></div></div><DataTable rows={list.rows} loading={list.loading} cols={[{ label: 'Date', render: (r) => dateFmt(r.created_at) }, { label: 'Event', key: 'event_key' }, { label: 'Message', key: 'body' }, { label: 'Delivery', render: (r) => <Badge value={r.delivery_status} /> }]} /><Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} /></div>
}

export function MyPaymentMethods() {
  const list = usePaged({ table: 'payment_methods', apply: (q) => q.eq('enabled', true), order: ['sort_order', true] })
  return <div><div className="page-head"><div><h1>Payment methods</h1><p>Payment options currently accepted by the business.</p></div></div><DataTable rows={list.rows} loading={list.loading} cols={[{ label: 'Method', key: 'name' }, { label: 'Provider', key: 'provider' }]} /></div>
}
