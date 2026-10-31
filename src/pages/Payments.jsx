import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { money, dateFmt, today } from '../lib/format'
import { Modal, Field, Pager, DataTable, usePaged, useOptions, useToast, Toast } from '../components/ui'

export const METHODS = ['bank_transfer', 'card', 'upi', 'cash', 'cheque']

export function PaymentForm({ invoice, onClose, onSaved }) {
  const { session } = useAuth()
  const open = useOptions('invoices', 'number', 'total, amount_paid, customer:profiles(full_name,email)', (q) => q.eq('status', 'confirmed').order('due_date'))
  const configuredMethods = useOptions('payment_methods', 'name', 'code,enabled,sort_order', (q) => q.eq('enabled', true).order('sort_order'))
  const [f, setF] = useState({ invoice_id: invoice?.id || '', method: 'bank_transfer', amount: invoice ? invoice.total - invoice.amount_paid : '', paid_on: today(), note: '', transaction_id: '' })
  const [err, setErr] = useState('')
  const pick = (id) => {
    const i = open.find((x) => x.id === id)
    setF({ ...f, invoice_id: id, amount: i ? (i.total - i.amount_paid).toFixed(2) : '' })
  }
  async function save(e) {
    e.preventDefault()
    const { error } = await supabase.from('payments').insert({ ...f, transaction_id: f.transaction_id.trim() || null, amount: Number(f.amount), created_by: session.user.id })
    if (error) return setErr(error.message)
    onSaved(); onClose()
  }
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <Field label="Invoice *">
          {invoice ? <input value={invoice.number} disabled /> : (
            <select required value={f.invoice_id} onChange={(e) => pick(e.target.value)}>
              <option value="">Select unpaid invoice…</option>
              {open.map((i) => <option key={i.id} value={i.id}>{i.number} — {i.customer?.full_name || i.customer?.email} — {money(i.total - i.amount_paid)} due</option>)}
            </select>
          )}
        </Field>
        <Field label="Method *">
          <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {(configuredMethods.length ? configuredMethods.map((m) => ({ value: m.code, label: m.name })) : METHODS.map((m) => ({ value: m, label: m.replace('_', ' ') }))).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Transaction reference"><input value={f.transaction_id} onChange={(e) => setF({ ...f, transaction_id: e.target.value })} /></Field>
        <Field label="Amount *"><input type="number" step="0.01" min="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date *"><input type="date" required value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></Field>
        <Field label="Note"><textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {err && <p className="err">{err}</p>}
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn">Save payment</button></div>
      </form>
    </Modal>
  )
}

export default function Payments() {
  const [method, setMethod] = useState('')
  const [adding, setAdding] = useState(false)
  const [toast, show] = useToast()
  const list = usePaged({
    table: 'payments', select: '*, invoice:invoices(number, customer:profiles(full_name,email))', order: ['paid_on', false],
    apply: (q) => (method ? q.eq('method', method) : q), deps: [method],
  })
  return (
    <div>
      <div className="page-head"><div><h1>Payments</h1><p>Every payment, matched to its invoice.</p></div>
        <button className="btn" onClick={() => setAdding(true)}>+ Record payment</button></div>
      <div className="toolbar">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">All methods</option>{METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
        </select>
      </div>
      <DataTable rows={list.rows} loading={list.loading} cols={[
        { label: 'Date', render: (r) => dateFmt(r.paid_on) },
        { label: 'Invoice', render: (r) => r.invoice?.number },
        { label: 'Customer', render: (r) => r.invoice?.customer?.full_name || r.invoice?.customer?.email },
        { label: 'Method', render: (r) => r.method.replace('_', ' ') },
        { label: 'Status', key: 'status' },
        { label: 'Transaction', key: 'transaction_id' },
        { label: 'Amount', right: true, render: (r) => money(r.amount) },
        { label: 'Note', key: 'note' },
      ]} />
      <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
      {adding && <PaymentForm onClose={() => setAdding(false)} onSaved={() => { show('Payment recorded'); list.reload() }} />}
      <Toast toast={toast} />
    </div>
  )
}
