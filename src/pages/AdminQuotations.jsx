import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, dateFmt, today } from '../lib/format'
import { Badge, DataTable, Field, Modal, Pager, Toast, useOptions, usePaged, useToast } from '../components/ui'

function QuoteForm({ onClose, onSaved }) {
  const customers = useOptions('profiles', 'email', 'full_name', (q) => q.eq('role', 'customer'))
  const plans = useOptions('plans', 'name', 'price, product_id, min_quantity', (q) => q.eq('active', true))
  const products = useOptions('products', 'name', 'sales_price', (q) => q.eq('active', true))
  const taxes = useOptions('taxes', 'name', 'rate_percent', (q) => q.eq('active', true))
  const templates = useOptions('quotation_templates', 'name', 'plan_id, validity_days, lines')
  const [f, setF] = useState({ customer_id: '', plan_id: '', template_id: '', valid_until: '', start_date: today(), payment_terms_days: 15, notes: '', discount_total: 0 })
  const [lines, setLines] = useState([])
  const [variants, setVariants] = useState({})
  const [loadingVariants, setLoadingVariants] = useState({})
  const [error, setError] = useState('')
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0)
  const taxRaw = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0) * Number(taxes.find((t) => t.id === line.tax_id)?.rate_percent || 0) / 100, 0)
  const taxTotal = taxRaw * (subtotal > 0 ? (subtotal - Number(f.discount_total || 0)) / subtotal : 1)

  function pickPlan(planId) {
    const plan = plans.find((x) => x.id === planId)
    setF({ ...f, plan_id: planId })
    if (plan?.product_id && !lines.length) setLines([{ product_id: plan.product_id, description: products.find((p) => p.id === plan.product_id)?.name || '', quantity: plan.min_quantity || 1, unit_price: plan.price, tax_id: '' }])
  }
  function applyTemplate(id) {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return setF({ ...f, template_id: '' })
    const until = new Date(); until.setDate(until.getDate() + (tpl.validity_days || 30))
    const templateLines = (tpl.lines || []).map((l) => ({ product_id: l.product_id, description: products.find((p) => p.id === l.product_id)?.name || '', quantity: l.quantity || 1, unit_price: Number(products.find((p) => p.id === l.product_id)?.sales_price || 0), tax_id: '' }))
    setF({ ...f, template_id: id, plan_id: tpl.plan_id || f.plan_id, valid_until: until.toISOString().slice(0, 10) })
    setLines(templateLines)
  }
  function updateLine(i, patch) { setLines((old) => old.map((line, n) => n === i ? { ...line, ...patch } : line)) }
  async function pickProduct(i, productId) {
    const product = products.find((x) => x.id === productId)
    setError('')
    setLoadingVariants((old) => ({ ...old, [productId]: true }))
    const { data, error: variantError } = await supabase.from('product_variants').select('id, attribute, value, extra_price').eq('product_id', productId).order('attribute')
    setVariants((old) => ({ ...old, [productId]: data || [] }))
    updateLine(i, { product_id: productId, variant_id: '', description: product?.name || '', unit_price: Number(product?.sales_price || 0) })
    setLoadingVariants((old) => ({ ...old, [productId]: false }))
    if (variantError) setError(`Could not load variants for ${product?.name || 'this product'}: ${variantError.message}`)
    else if (!data?.length) setError(`No variants are set up for ${product?.name || 'this product'}. You can still quote it without a variant.`)
  }
  function pickVariant(i, variantId) {
    const line = lines[i]; const variant = (variants[line.product_id] || []).find((x) => x.id === variantId)
    const product = products.find((x) => x.id === line.product_id)
    updateLine(i, { variant_id: variantId, unit_price: Number(product?.sales_price || 0) + Number(variant?.extra_price || 0) })
  }
  async function save(e) {
    e.preventDefault(); setError('')
    if (!lines.length) return setError('Add at least one quotation line.')
    if (lines.some((line) => !line.product_id)) return setError('Choose a product for each line.')
    const { data, error: err } = await supabase.rpc('create_quotation', {
      p_quote: { ...f, payment_terms_days: Number(f.payment_terms_days), discount_total: Number(f.discount_total || 0) },
      p_items: lines.map((line) => ({ ...line, variant_id: line.variant_id || null, tax_id: line.tax_id || null, quantity: Number(line.quantity), unit_price: Number(line.unit_price) })),
    })
    if (err) return setError(err.message)
    onSaved(data); onClose()
  }
  return <Modal title="Create quotation" onClose={onClose} wide>
    <form onSubmit={save}>
      <div className="form-grid cols2">
        <Field label="Template"><select value={f.template_id} onChange={(e) => applyTemplate(e.target.value)}><option value="">Start blank</option>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Customer *"><select required value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })}><option value="">Select customer</option>{customers.map((x) => <option key={x.id} value={x.id}>{x.full_name || x.email} · {x.email}</option>)}</select></Field>
        <Field label="Plan *"><select required value={f.plan_id} onChange={(e) => pickPlan(e.target.value)}><option value="">Select plan</option>{plans.map((x) => <option key={x.id} value={x.id}>{x.name} · {money(x.price)}</option>)}</select></Field>
        <Field label="Quote valid until"><input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} /></Field>
        <Field label="Subscription start date"><input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} required /></Field>
        <Field label="Payment terms (days)"><input type="number" min="0" value={f.payment_terms_days} onChange={(e) => setF({ ...f, payment_terms_days: e.target.value })} /></Field>
        <Field label="Notes"><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <h4>Quotation lines</h4>
      {lines.map((line, i) => <div className="line-row" key={i}>
        <select value={line.product_id} onChange={(e) => pickProduct(i, e.target.value)}><option value="">Product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={line.variant_id || ''} onChange={(e) => pickVariant(i, e.target.value)} disabled={!line.product_id || loadingVariants[line.product_id] || !(variants[line.product_id] || []).length}><option value="">{loadingVariants[line.product_id] ? 'Loading variants…' : (variants[line.product_id] || []).length ? 'No variant' : 'No variants available'}</option>{(variants[line.product_id] || []).map((v) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extra_price)})</option>)}</select>
        <input value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Line description" />
        <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} title="Quantity" />
        <input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} title="Unit price" />
        <select value={line.tax_id} onChange={(e) => updateLine(i, { tax_id: e.target.value })}><option value="">No tax</option>{taxes.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.rate_percent}%</option>)}</select>
        <button type="button" className="link danger" onClick={() => setLines(lines.filter((_, n) => n !== i))}>Remove</button>
      </div>)}
      <button type="button" className="btn ghost" onClick={() => setLines([...lines, { product_id: '', description: '', quantity: 1, unit_price: 0, tax_id: '' }])}>+ Add line</button>
      <div className="form-grid cols2" style={{ marginTop: 12 }}><Field label="Discount amount"><input type="number" min="0" max={subtotal} step="0.01" value={f.discount_total} onChange={(e) => setF({ ...f, discount_total: e.target.value })} /></Field></div>
      <p className="total-line">Subtotal {money(subtotal)} · Discount {money(f.discount_total)} · Tax {money(taxTotal)} · <b>Total {money(subtotal - Number(f.discount_total || 0) + taxTotal)}</b></p>
      {error && <p className="err">{error}</p>}
      <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn">Save draft</button></div>
    </form>
  </Modal>
}

function QuoteDetail({ quote, onClose, reload }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [toast, show] = useToast()
  useEffect(() => { supabase.from('quotation_items').select('*, product:products(name), variant:product_variants(attribute,value)').eq('quotation_id', quote.id).then(({ data }) => setItems(data || [])) }, [quote.id])
  async function setStatus(status) {
    const { error } = await supabase.from('quotations').update({ status }).eq('id', quote.id)
    if (error) return show(error.message, 'err')
    show(`Quotation marked ${status}`); reload()
  }
  async function convert() {
    setBusy(true)
    const { data, error } = await supabase.rpc('convert_quotation', { p_quote: quote.id })
    setBusy(false)
    if (error) return show(error.message, 'err')
    show(`Created subscription ${data}`); reload(); onClose()
  }
  function send() {
    const customer = quote.customer || {}
    const body = encodeURIComponent(`Hello ${customer.full_name || ''},\n\nQuotation ${quote.number} is for ${money(quote.total)} and is valid until ${dateFmt(quote.valid_until)}.`)
    window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent(`Quotation ${quote.number}`)}&body=${body}`
    setStatus('sent')
  }
  return <Modal title={`Quotation ${quote.number}`} onClose={onClose} wide>
    <div className="meta"><div><span>Customer</span>{quote.customer?.full_name || quote.customer?.email}</div><div><span>Status</span><Badge value={quote.status} /></div><div><span>Valid until</span>{dateFmt(quote.valid_until)}</div><div><span>Total</span>{money(quote.total)}</div><div><span>Linked subscription</span>{quote.subscription_id || '—'}</div></div>
    <table className="tbl"><thead><tr><th>Product</th><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Tax</th></tr></thead><tbody>{items.map((x) => <tr key={x.id}><td>{x.product?.name || '—'}{x.variant ? ` · ${x.variant.value}` : ''}</td><td>{x.description}</td><td className="r">{x.quantity}</td><td className="r">{money(x.unit_price)}</td><td className="r">{x.tax_rate}%</td></tr>)}</tbody></table>
    {quote.notes && <p>{quote.notes}</p>}
    <div className="form-actions"><button className="btn ghost" onClick={() => window.print()}>Print</button><button className="btn ghost" onClick={send}>Send by email</button>{quote.status !== 'accepted' && <button className="btn ghost" onClick={() => setStatus('accepted')}>Mark accepted</button>}{quote.status === 'accepted' && !quote.subscription_id && <button className="btn" disabled={busy} onClick={convert}>{busy ? 'Converting…' : 'Convert to subscription'}</button>}</div>
    <Toast toast={toast} />
  </Modal>
}

export default function AdminQuotations() {
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(null)
  const [toast, show] = useToast()
  const list = usePaged({ table: 'quotations', select: '*, customer:profiles!quotations_customer_id_fkey(full_name,email)', order: ['created_at', false] })
  async function quotationSaved(id) {
    show('Quotation saved')
    list.setPage(0)
    list.reload()
    const { data, error } = await supabase.from('quotations').select('*, customer:profiles!quotations_customer_id_fkey(full_name,email)').eq('id', id).single()
    if (error) return show(`Saved, but could not reopen the quotation: ${error.message}`, 'err')
    setOpen(data)
  }
  return <div>
    <div className="page-head"><div><h1>Quotations</h1><p>Build a priced quote, send it to the customer, then convert an accepted quote into a subscription.</p></div><button className="btn" onClick={() => setCreating(true)}>+ Create quotation</button></div>
    {list.error && <p className="err">Could not load quotations: {list.error.message}</p>}
    <DataTable rows={list.rows} loading={list.loading} onRow={setOpen} cols={[{ label: 'Quotation', render: (r) => <b>{r.number}</b> }, { label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email }, { label: 'Valid until', render: (r) => dateFmt(r.valid_until) }, { label: 'Total', right: true, render: (r) => money(r.total) }, { label: 'Status', render: (r) => <Badge value={r.status} /> }, { label: 'Subscription', render: (r) => r.subscription_id ? <span className="muted">Converted</span> : '—' }]} />
    <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
    {creating && <QuoteForm onClose={() => setCreating(false)} onSaved={quotationSaved} />}
    {open && <QuoteDetail quote={open} onClose={() => setOpen(null)} reload={list.reload} />}
    <Toast toast={toast} />
  </div>
}
