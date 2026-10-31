import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Badge, DataTable, Field, Modal, Pager, Toast, usePaged, useToast } from '../components/ui'
import { dateFmt } from '../lib/format'

function TicketDetail({ ticket, onClose, reload }) {
  const { profile, isStaff } = useAuth()
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState(ticket.status)
  const [toast, show] = useToast()
  async function load() {
    const { data, error } = await supabase.from('support_messages').select('*, sender:profiles(full_name,email)').eq('ticket_id', ticket.id).order('created_at')
    if (error) show(error.message, 'err'); else setMessages(data || [])
  }
  useEffect(() => { load() }, [ticket.id]) // eslint-disable-line
  async function send(e) {
    e.preventDefault()
    const { error } = await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_id: profile.id, message: reply.trim() })
    if (error) return show(error.message, 'err')
    setReply(''); await load()
    if (isStaff) await supabase.from('support_tickets').update({ status: 'waiting_customer' }).eq('id', ticket.id)
    reload()
  }
  async function saveStatus(value) {
    const { error } = await supabase.from('support_tickets').update({ status: value }).eq('id', ticket.id)
    if (error) return show(error.message, 'err')
    setStatus(value); reload()
  }
  return <Modal title={`Ticket · ${ticket.subject}`} onClose={onClose} wide>
    <div className="meta"><div><span>Customer</span>{ticket.customer?.full_name || ticket.customer?.email || profile.email}</div><div><span>Priority</span><Badge value={ticket.priority} /></div><div><span>Status</span>{isStaff ? <select value={status} onChange={(e) => saveStatus(e.target.value)}>{['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select> : <Badge value={status} />}</div><div><span>Category</span>{ticket.category || '—'}</div></div>
    <p>{ticket.description}</p>
    <div className="ticket-thread">{messages.map((m) => <div className="ticket-message" key={m.id}><b>{m.sender?.full_name || m.sender?.email || 'Support'} <small>{dateFmt(m.created_at)}</small></b><p>{m.message}</p></div>)}{messages.length === 0 && <p className="muted">No replies yet.</p>}</div>
    {status !== 'closed' && <form className="form-grid" onSubmit={send}><Field label="Reply"><textarea required rows={3} value={reply} onChange={(e) => setReply(e.target.value)} /></Field><div className="form-actions"><button className="btn">Send reply</button></div></form>}
    <Toast toast={toast} />
  </Modal>
}

export default function SupportTickets({ customerOnly = false }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'billing', priority: 'normal', description: '' })
  const [toast, show] = useToast()
  const list = usePaged({ table: 'support_tickets', select: '*, customer:profiles!support_tickets_customer_id_fkey(full_name,email)', order: ['updated_at', false], apply: (q) => customerOnly ? q.eq('customer_id', profile.id) : q })
  async function create(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('support_tickets').insert({ ...form, customer_id: profile.id }).select().single()
    if (error) return show(error.message, 'err')
    const { error: messageError } = await supabase.from('support_messages').insert({ ticket_id: data.id, sender_id: profile.id, message: form.description })
    if (messageError) show(messageError.message, 'err'); else show('Support ticket submitted')
    setCreating(false); setForm({ subject: '', category: 'billing', priority: 'normal', description: '' }); list.setPage(0); list.reload()
  }
  return <div>
    <div className="page-head"><div><h1>{customerOnly ? 'Support' : 'Support tickets'}</h1><p>{customerOnly ? 'Ask our team for help and follow replies here.' : 'Review customer requests and reply from the ticket thread.'}</p></div>{customerOnly && <button className="btn" onClick={() => setCreating(true)}>New support request</button>}</div>
    {list.error && <p className="err">Could not load support tickets: {list.error.message}</p>}
    <DataTable rows={list.rows} loading={list.loading} onRow={setOpen} cols={[{ label: 'Subject', render: (r) => <b>{r.subject}</b> }, ...(!customerOnly ? [{ label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email }] : []), { label: 'Category', key: 'category' }, { label: 'Priority', render: (r) => <Badge value={r.priority} /> }, { label: 'Status', render: (r) => <Badge value={r.status} /> }, { label: 'Updated', render: (r) => dateFmt(r.updated_at) }]} />
    <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
    {open && <TicketDetail ticket={open} onClose={() => setOpen(null)} reload={list.reload} />}
    {creating && <Modal title="New support request" onClose={() => setCreating(false)}><form className="form-grid" onSubmit={create}><Field label="Subject"><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field><Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['billing', 'subscription', 'technical', 'account', 'other'].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['low', 'normal', 'high', 'urgent'].map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Describe the issue"><textarea required rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><div className="form-actions"><button className="btn">Submit request</button></div></form></Modal>}
    <Toast toast={toast} />
  </div>
}
