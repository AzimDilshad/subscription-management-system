import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dateFmt } from '../lib/format'
import { Badge, Modal, Field, Pager, DataTable, usePaged, useToast, Toast } from '../components/ui'

export default function Users() {
  const { isAdmin, session } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, show] = useToast()
  const list = usePaged({
    table: 'profiles', size: 15,
    apply: (x) => { if (q) x = x.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`); if (role) x = x.eq('role', role); return x },
    deps: [q, role],
  })

  async function setUserRole(id, r) {
    const { error } = await supabase.from('profiles').update({ role: r }).eq('id', id)
    if (error) show(error.message, 'err'); else { show('Role updated'); list.reload() }
  }
  async function addStaff(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('profiles').update({ role: 'staff' }).eq('email', email.trim().toLowerCase()).select()
    if (error) return show(error.message, 'err')
    if (!data.length) return show('No account with that email yet — ask them to sign up first.', 'err')
    show('Added as staff'); setAdding(false); setEmail(''); list.reload()
  }
  async function saveCustomer(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ full_name: editing.full_name, phone: editing.phone || null, company_name: editing.company_name || null, gstin: editing.gstin || null, customer_status: editing.customer_status, internal_notes: editing.internal_notes || null }).eq('id', editing.id)
    if (error) return show(error.message, 'err')
    show('Customer details updated'); setEditing(null); list.reload()
  }
  return (
    <div>
      <div className="page-head"><div><h1>Users & staff</h1><p>Only an admin can add staff or change roles.</p></div>
        {isAdmin && <button className="btn" onClick={() => setAdding(true)}>+ Add staff member</button>}</div>
      <div className="toolbar">
        <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option><option>admin</option><option>staff</option><option>customer</option>
        </select>
      </div>
      <DataTable rows={list.rows} loading={list.loading} cols={[
        { label: 'Name', render: (r) => r.full_name || '—' }, { label: 'Email', key: 'email' },
        { label: 'Phone', render: (r) => r.phone || '—' }, { label: 'Company', render: (r) => r.company_name || '—' },
        { label: 'Joined', render: (r) => dateFmt(r.created_at) },
        { label: 'Role', render: (r) => isAdmin && r.id !== session.user.id ? (
          <select value={r.role} onChange={(e) => setUserRole(r.id, e.target.value)}>
            <option>admin</option><option>staff</option><option>customer</option></select>
        ) : <Badge value={r.role} tone="blue" /> },
        ...(isAdmin ? [{ label: '', right: true, render: (r) => r.role === 'customer' ? <button className="link" onClick={() => setEditing({ ...r })}>Customer details</button> : null }] : []),
      ]} />
      <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
      {adding && (
        <Modal title="Add staff member" onClose={() => setAdding(false)}>
          <form className="form-grid" onSubmit={addStaff}>
            <Field label="Their registered email" hint="They must have signed up first; this gives them staff access.">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <div className="form-actions"><button className="btn">Make staff</button></div>
          </form>
        </Modal>
      )}
      {editing && <Modal title={`Customer · ${editing.email}`} onClose={() => setEditing(null)}><form className="form-grid" onSubmit={saveCustomer}><Field label="Name"><input value={editing.full_name || ''} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></Field><Field label="Phone"><input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field><Field label="Company"><input value={editing.company_name || ''} onChange={(e) => setEditing({ ...editing, company_name: e.target.value })} /></Field><Field label="GSTIN"><input value={editing.gstin || ''} onChange={(e) => setEditing({ ...editing, gstin: e.target.value })} /></Field><Field label="Account status"><select value={editing.customer_status || 'active'} onChange={(e) => setEditing({ ...editing, customer_status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field><Field label="Internal notes"><textarea rows={3} value={editing.internal_notes || ''} onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} /></Field><div className="form-actions"><button className="btn">Save customer</button></div></form></Modal>}
      <Toast toast={toast} />
    </div>
  )
}
