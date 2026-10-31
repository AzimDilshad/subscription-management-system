import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, dateFmt, isOverdue } from '../lib/format'
import { Modal, Badge, useToast, Toast } from './ui'
import { PaymentForm } from '../pages/Payments'

export default function InvoiceView({ invoice, staff, onClose, onChanged }) {
  const [inv, setInv] = useState(invoice)
  const [lines, setLines] = useState([])
  const [pays, setPays] = useState([])
  const [paying, setPaying] = useState(false)
  const [toast, show] = useToast()

  async function load() {
    const [i, l, p] = await Promise.all([
      supabase.from('invoices').select('*, customer:profiles(full_name,email), subscription:subscriptions(number,payment_terms_days)').eq('id', invoice.id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', invoice.id).order('amount', { ascending: false }),
      supabase.from('payments').select('*').eq('invoice_id', invoice.id).order('paid_on'),
    ])
    if (i.data) setInv(i.data)
    setLines(l.data || []); setPays(p.data || [])
  }
  useEffect(() => { load() }, [invoice.id]) // eslint-disable-line

  async function setStatus(status, extra = {}) {
    const { error } = await supabase.from('invoices').update({ status, ...extra }).eq('id', inv.id)
    if (error) return show(error.message, 'err')
    show('Invoice ' + status); await load(); onChanged?.()
  }
  function send() {
    const to = inv.customer?.email || ''
    const body = `Hi ${inv.customer?.full_name || ''},%0D%0A%0D%0AInvoice ${inv.number} for ${money(inv.total)} is due on ${dateFmt(inv.due_date)}.`
    window.open(`mailto:${to}?subject=Invoice ${inv.number} from Brightloop&body=${body}`)
    setStatus(inv.status, { sent_at: new Date().toISOString() })
  }
  const balance = inv.total - inv.amount_paid

  return (
    <Modal title={`Invoice ${inv.number}`} onClose={onClose} wide>
      <div className="print-area">
        <div className="inv-head">
          <div><h2>Brightloop<span style={{ color: '#6338e8' }}>.</span></h2><small>Subscription invoice</small></div>
          <div className="r">
            <Badge value={isOverdue(inv) ? 'overdue' : inv.status} tone={isOverdue(inv) ? 'bad' : inv.status} />
            <div>Issued {dateFmt(inv.issue_date)}</div><div>Due {dateFmt(inv.due_date)}</div>
          </div>
        </div>
        <div className="meta">
          <div><span>Billed to</span>{inv.customer?.full_name || inv.customer?.email}<br /><small>{inv.customer?.email}</small></div>
          <div><span>Subscription</span>{inv.subscription?.number || '—'}</div>
          <div><span>Period</span>{dateFmt(inv.period_start)} – {dateFmt(inv.period_end)}</div>
        </div>
        <table className="tbl"><thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Tax</th><th className="r">Amount</th></tr></thead>
          <tbody>{lines.map((l) => (
            <tr key={l.id}><td>{l.description}</td><td className="r">{l.quantity}</td><td className="r">{money(l.unit_price)}</td><td className="r">{l.tax_rate}%</td><td className="r">{money(l.amount)}</td></tr>))}</tbody></table>
        <div className="totals">
          <div><span>Subtotal</span>{money(inv.subtotal)}</div>
          {inv.discount_total > 0 && <div><span>Discounts</span>− {money(inv.discount_total)}</div>}
          <div><span>Tax</span>{money(inv.tax_total)}</div>
          <div className="grand"><span>Total</span>{money(inv.total)}</div>
          <div><span>Paid</span>{money(inv.amount_paid)}</div>
          <div className="grand"><span>Balance due</span>{money(balance)}</div>
        </div>
        {pays.length > 0 && <div className="chips">{pays.map((p) => <span key={p.id} className="chip">{dateFmt(p.paid_on)} · {p.method.replace('_', ' ')} · {money(p.amount)}{p.note ? ' · ' + p.note : ''}</span>)}</div>}
      </div>

      <div className="form-actions no-print">
        <button className="btn ghost" onClick={() => window.print()}>🖨 Print</button>
        {staff && <>
          <button className="btn ghost" onClick={send}>✉ Send</button>
          {inv.status === 'draft' && <button className="btn" onClick={() => setStatus('confirmed')}>Confirm</button>}
          {['draft', 'confirmed'].includes(inv.status) && <button className="btn danger-btn" onClick={() => window.confirm('Cancel this invoice?') && setStatus('cancelled')}>Cancel invoice</button>}
          {inv.status === 'confirmed' && <button className="btn" onClick={() => setPaying(true)}>+ Record payment</button>}
        </>}
      </div>
      {paying && <PaymentForm invoice={inv} onClose={() => setPaying(false)} onSaved={() => { load(); onChanged?.() }} />}
      <Toast toast={toast} />
    </Modal>
  )
}
