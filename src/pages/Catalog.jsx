import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CrudPage from '../components/CrudPage'
import { Modal, Badge } from '../components/ui'
import { money, dateFmt } from '../lib/format'

const yes = (v) => (v ? <Badge value="yes" tone="paid" /> : <span className="muted">no</span>)

/* ---------- variants editor (e.g. Brand = Odoo → +560) ---------- */
function Variants({ product, onClose }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ attribute: 'Brand', value: '', extra_price: '' })
  const [err, setErr] = useState('')
  const load = () => supabase.from('product_variants').select('*').eq('product_id', product.id).order('value').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [product.id]) // eslint-disable-line

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('product_variants').insert({ ...f, extra_price: Number(f.extra_price || 0), product_id: product.id })
    if (error) return setErr(error.message)
    setErr(''); setF({ ...f, value: '', extra_price: '' }); load()
  }
  return (
    <Modal title={`Variants — ${product.name}`} onClose={onClose}>
      <table className="tbl"><thead><tr><th>Attribute</th><th>Value</th><th className="r">Extra price</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan="4" className="muted">No variants yet.</td></tr>}
          {rows.map((v) => (
            <tr key={v.id}><td>{v.attribute}</td><td>{v.value}</td><td className="r">+ {money(v.extra_price)}</td>
              <td className="r"><button className="link danger" onClick={() => supabase.from('product_variants').delete().eq('id', v.id).then(load)}>Remove</button></td></tr>
          ))}
        </tbody></table>
      <form className="inline-form" onSubmit={add}>
        <input placeholder="Attribute (Brand)" value={f.attribute} onChange={(e) => setF({ ...f, attribute: e.target.value })} required />
        <input placeholder="Value (Odoo)" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required />
        <input type="number" placeholder="Extra price" value={f.extra_price} onChange={(e) => setF({ ...f, extra_price: e.target.value })} />
        <button className="btn">Add</button>
      </form>
      {err && <p className="err">{err}</p>}
    </Modal>
  )
}

export function Products() {
  const [v, setV] = useState(null)
  return (
    <>
      <CrudPage
        title="Products" subtitle="What you sell. Add variants to price by brand, size, edition…"
        table="products" select="*, category:product_categories(name)"
        canImport
        columns={[
          { label: 'Name', key: 'name' }, { label: 'Type', key: 'type' }, { label: 'SKU', key: 'sku' },
          { label: 'Category', render: (r) => r.category?.name || '—' },
          { label: 'Sales price', right: true, render: (r) => money(r.sales_price) },
          { label: 'Cost price', right: true, render: (r) => money(r.cost_price) },
          { label: 'Active', render: (r) => yes(r.active) },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'sku', label: 'SKU' },
          { key: 'category_id', label: 'Category', type: 'select', from: { table: 'product_categories' } },
          { key: 'type', label: 'Type', type: 'select', required: true, default: 'service', options: ['service', 'software', 'add-on', 'physical'].map((x) => ({ value: x, label: x })) },
          { key: 'sales_price', label: 'Sales price', type: 'number', required: true, default: 0 },
          { key: 'cost_price', label: 'Cost price', type: 'number', required: true, default: 0 },
          { key: 'notes', label: 'Notes', type: 'textarea' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'active', label: 'Active', type: 'checkbox', default: true },
        ]}
        rowActions={(r) => <button onClick={() => setV(r)}>Variants</button>}
      />
      {v && <Variants product={v} onClose={() => setV(null)} />}
    </>
  )
}

export const Plans = () => (
  <CrudPage
    title="Plans" subtitle="Price, billing period and lifecycle rules — decided plan by plan."
    table="plans" select="*, product:products(name)"
    columns={[
      { label: 'Plan', key: 'name' },
      { label: 'Product', render: (r) => r.product?.name || '—' },
      { label: 'Price', right: true, render: (r) => money(r.price) },
      { label: 'Billing', render: (r) => <Badge value={r.billing_period} tone="blue" /> },
      { label: 'Min qty', key: 'min_quantity' },
      { label: 'Available', render: (r) => `${dateFmt(r.start_date)} → ${dateFmt(r.end_date)}` },
      { label: 'Auto-close', render: (r) => yes(r.auto_close) },
      { label: 'Active', render: (r) => yes(r.active) },
    ]}
    fields={[
      { key: 'name', label: 'Plan name', required: true },
      { key: 'product_id', label: 'Product', type: 'select', from: { table: 'products' } },
      { key: 'price', label: 'Price', type: 'number', required: true, default: 0 },
      { key: 'billing_period', label: 'Billing period', type: 'select', required: true, default: 'monthly', options: ['daily', 'weekly', 'monthly', 'yearly'].map((x) => ({ value: x, label: x })) },
      { key: 'min_quantity', label: 'Minimum quantity', type: 'number', required: true, default: 1 },
      { key: 'start_date', label: 'Available from', type: 'date' },
      { key: 'end_date', label: 'Available until', type: 'date' },
      { key: 'auto_close', label: 'Close automatically at end date', type: 'checkbox' },
      { key: 'can_close', label: 'Can be closed early', type: 'checkbox', default: true },
      { key: 'can_pause', label: 'Can be paused', type: 'checkbox' },
      { key: 'can_renew', label: 'Can be renewed', type: 'checkbox', default: true },
      { key: 'active', label: 'Active', type: 'checkbox', default: true },
    ]}
  />
)

export const Taxes = () => (
  <CrudPage
    title="Taxes" subtitle="Rules applied automatically on every invoice line." table="taxes" order={['name', true]}
    columns={[{ label: 'Name', key: 'name' }, { label: 'Rate', render: (r) => r.rate_percent + '%' }, { label: 'Active', render: (r) => yes(r.active) }]}
    fields={[
      { key: 'name', label: 'Name (e.g. GST 18%)', required: true },
      { key: 'tax_code', label: 'Tax code' },
      { key: 'tax_type', label: 'Tax type', type: 'select', default: 'GST', options: ['GST', 'CGST', 'SGST', 'IGST', 'VAT', 'other'].map((x) => ({ value: x, label: x })) },
      { key: 'rate_percent', label: 'Rate %', type: 'number', required: true, default: 18 },
      { key: 'hsn_sac', label: 'HSN / SAC code' },
      { key: 'inclusive', label: 'Price includes tax', type: 'checkbox' },
      { key: 'effective_from', label: 'Effective from', type: 'date' },
      { key: 'effective_until', label: 'Effective until', type: 'date' },
      { key: 'active', label: 'Active', type: 'checkbox', default: true },
    ]}
  />
)

export const Discounts = () => (
  <CrudPage
    title="Discounts" subtitle="Applied automatically on the next invoice, until they expire or run out."
    table="discounts" select="*, product:products(name)" order={['name', true]}
    columns={[
      { label: 'Name', key: 'name' },
      { label: 'Value', render: (r) => (r.type === 'percent' ? r.value + '%' : money(r.value)) },
      { label: 'Applies to', render: (r) => (r.applies_to === 'product' ? r.product?.name || 'product' : 'subscription') },
      { label: 'Min', render: (r) => `${money(r.min_purchase)} / ${r.min_quantity} qty` },
      { label: 'Valid', render: (r) => `${dateFmt(r.start_date)} → ${dateFmt(r.end_date)}` },
      { label: 'Used', render: (r) => `${r.used_count}${r.usage_limit ? ' / ' + r.usage_limit : ''}` },
      { label: 'Active', render: (r) => yes(r.active) },
    ]}
    fields={[
      { key: 'name', label: 'Name', required: true },
      { key: 'code', label: 'Coupon code' },
      { key: 'type', label: 'Type', type: 'select', required: true, default: 'percent', options: [{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }] },
      { key: 'value', label: 'Value', type: 'number', required: true, default: 10 },
      { key: 'applies_to', label: 'Applies to', type: 'select', required: true, default: 'product', options: [{ value: 'product', label: 'A product' }, { value: 'subscription', label: 'A whole subscription' }] },
      { key: 'product_id', label: 'Product (if product discount)', type: 'select', from: { table: 'products' } },
      { key: 'subscription_id', label: 'Subscription ID (if subscription discount)', hint: 'Paste the subscription id from the Subscriptions screen' },
      { key: 'min_purchase', label: 'Minimum purchase', type: 'number', required: true, default: 0 },
      { key: 'min_quantity', label: 'Minimum quantity', type: 'number', required: true, default: 0 },
      { key: 'start_date', label: 'Start date', type: 'date' },
      { key: 'end_date', label: 'End date', type: 'date' },
      { key: 'usage_limit', label: 'Usage limit', type: 'number', hint: 'Leave empty for unlimited' },
      { key: 'per_customer_limit', label: 'Per-customer use limit', type: 'number' },
      { key: 'first_billing_only', label: 'First billing only', type: 'checkbox' },
      { key: 'active', label: 'Active', type: 'checkbox', default: true },
    ]}
  />
)
