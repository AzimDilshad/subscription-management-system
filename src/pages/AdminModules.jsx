import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CrudPage from '../components/CrudPage'
import { Badge, DataTable, Pager, Toast, usePaged, useToast } from '../components/ui'
import { dateFmt, money } from '../lib/format'
import AdminQuotations from './AdminQuotations'
import SupportTickets from './SupportTickets'
import AutomationCenter from './AutomationCenter'

const yes = (value) => <Badge value={value ? 'active' : 'inactive'} />

const config = {
  categories: {
    title: 'Product categories', subtitle: 'Organize the product catalog for staff and customers.', table: 'product_categories', order: ['name', true],
    columns: [{ label: 'Category', key: 'name' }, { label: 'Description', key: 'description' }, { label: 'Status', render: (r) => yes(r.active) }],
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'active', label: 'Active', type: 'checkbox', default: true }],
  },
  taxRules: {
    title: 'Tax rules', subtitle: 'Configure product and customer tax exceptions by place of supply and effective dates.', table: 'tax_rules', select: '*, tax:taxes(name,rate_percent), product:products(name), customer:profiles(full_name,email)', order: ['priority', false],
    columns: [{ label: 'Rule', key: 'name' }, { label: 'Tax', render: (r) => r.tax ? `${r.tax.name} · ${r.tax.rate_percent}%` : '—' }, { label: 'Product', render: (r) => r.product?.name || 'All products' }, { label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email || 'All customers' }, { label: 'Place of supply', render: (r) => [r.state, r.country].filter(Boolean).join(', ') || 'Any' }, { label: 'Active', render: (r) => yes(r.active) }],
    fields: [{ key: 'name', label: 'Rule name', required: true }, { key: 'tax_id', label: 'Tax', type: 'select', from: { table: 'taxes' }, required: true }, { key: 'product_id', label: 'Product', type: 'select', from: { table: 'products' } }, { key: 'customer_id', label: 'Customer email', type: 'select', from: { table: 'profiles', label: 'email' } }, { key: 'country', label: 'Country' }, { key: 'state', label: 'State / place of supply' }, { key: 'priority', label: 'Priority', type: 'number', default: 0 }, { key: 'effective_from', label: 'Effective from', type: 'date' }, { key: 'effective_until', label: 'Effective until', type: 'date' }, { key: 'active', label: 'Active', type: 'checkbox', default: true }],
  },
  quotes: {
    title: 'Quotations', subtitle: 'Track quotes, validity, customer decisions and conversion to subscriptions.', table: 'quotations', select: '*, customer:profiles!quotations_customer_id_fkey(full_name,email)', order: ['created_at', false], searchKey: 'number',
    columns: [{ label: 'Quote', key: 'number' }, { label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email }, { label: 'Valid until', render: (r) => dateFmt(r.valid_until) }, { label: 'Total', render: (r) => money(r.total) }, { label: 'Status', render: (r) => <Badge value={r.status} /> }],
    fields: [{ key: 'customer_id', label: 'Customer', type: 'select', from: { table: 'profiles', label: 'email' }, required: true }, { key: 'status', label: 'Status', type: 'select', default: 'draft', options: ['draft', 'sent', 'accepted', 'rejected', 'expired'].map((x) => ({ value: x, label: x })) }, { key: 'valid_until', label: 'Valid until', type: 'date' }, { key: 'subtotal', label: 'Subtotal', type: 'number', default: 0 }, { key: 'discount_total', label: 'Discount', type: 'number', default: 0 }, { key: 'tax_total', label: 'Tax', type: 'number', default: 0 }, { key: 'total', label: 'Total', type: 'number', default: 0 }, { key: 'notes', label: 'Notes', type: 'textarea' }],
  },
  refunds: {
    title: 'Refunds', subtitle: 'Keep a record of refund requests and completed refunds.', table: 'refunds', select: '*, payment:payments(amount,method)', order: ['created_at', false],
    columns: [{ label: 'Payment', render: (r) => r.payment_id?.slice(0, 8) }, { label: 'Amount', render: (r) => money(r.amount) }, { label: 'Reason', key: 'reason' }, { label: 'Status', render: (r) => <Badge value={r.status} /> }, { label: 'Created', render: (r) => dateFmt(r.created_at) }],
    fields: [{ key: 'payment_id', label: 'Payment', type: 'select', from: { table: 'payments', label: 'id' }, required: true }, { key: 'amount', label: 'Refund amount', type: 'number', required: true }, { key: 'reason', label: 'Reason', type: 'textarea' }, { key: 'status', label: 'Status', type: 'select', default: 'requested', options: ['requested', 'processing', 'completed', 'failed'].map((x) => ({ value: x, label: x })) }, { key: 'external_reference', label: 'Gateway reference' }],
  },
  support: {
    title: 'Support tickets', subtitle: 'Review customer requests, set priority and assign them to staff.', table: 'support_tickets', select: '*, customer:profiles!support_tickets_customer_id_fkey(full_name,email)', order: ['updated_at', false], searchKey: 'subject',
    columns: [{ label: 'Subject', key: 'subject' }, { label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email }, { label: 'Category', key: 'category' }, { label: 'Priority', render: (r) => <Badge value={r.priority} /> }, { label: 'Status', render: (r) => <Badge value={r.status} /> }, { label: 'Updated', render: (r) => dateFmt(r.updated_at) }],
    fields: [{ key: 'customer_id', label: 'Customer', type: 'select', from: { table: 'profiles', label: 'email' }, required: true }, { key: 'subject', label: 'Subject', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority', type: 'select', default: 'normal', options: ['low', 'normal', 'high', 'urgent'].map((x) => ({ value: x, label: x })) }, { key: 'status', label: 'Status', type: 'select', default: 'open', options: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map((x) => ({ value: x, label: x })) }],
  },
  notifications: {
    title: 'Notification templates', subtitle: 'Configure reusable messages for supported email and in-app events.', table: 'notification_templates', order: ['event_key', true], searchKey: 'event_key',
    columns: [{ label: 'Event', key: 'event_key' }, { label: 'Channel', key: 'channel' }, { label: 'Subject', key: 'subject' }, { label: 'Enabled', render: (r) => yes(r.enabled) }],
    fields: [{ key: 'event_key', label: 'Event key', required: true }, { key: 'channel', label: 'Channel', type: 'select', default: 'email', options: ['email', 'in_app', 'sms', 'whatsapp', 'push'].map((x) => ({ value: x, label: x })) }, { key: 'subject', label: 'Subject' }, { key: 'body', label: 'Message body', type: 'textarea', required: true }, { key: 'enabled', label: 'Enabled', type: 'checkbox', default: true }],
  },
  paymentMethods: {
    title: 'Payment methods', subtitle: 'Control which payment methods are offered and their display order.', table: 'payment_methods', order: ['sort_order', true],
    columns: [{ label: 'Name', key: 'name' }, { label: 'Code', key: 'code' }, { label: 'Provider', key: 'provider' }, { label: 'Enabled', render: (r) => yes(r.enabled) }],
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true }, { key: 'provider', label: 'Provider' }, { key: 'enabled', label: 'Enabled', type: 'checkbox', default: true }, { key: 'sort_order', label: 'Sort order', type: 'number', default: 0 }],
  },
  automation: {
    title: 'Automation rules', subtitle: 'Manage supported event rules and reminder timing. Execution requires a trusted server-side worker.', table: 'automation_rules', order: ['name', true],
    columns: [{ label: 'Rule', key: 'name' }, { label: 'Trigger', key: 'trigger_key' }, { label: 'Enabled', render: (r) => yes(r.enabled) }, { label: 'Updated', render: (r) => dateFmt(r.updated_at) }],
    fields: [{ key: 'name', label: 'Rule name', required: true }, { key: 'trigger_key', label: 'Trigger key', required: true }, { key: 'conditions', label: 'Conditions (JSON)', type: 'textarea' }, { key: 'actions', label: 'Actions (JSON)', type: 'textarea' }, { key: 'enabled', label: 'Enabled', type: 'checkbox', default: true }],
  },
  settings: {
    title: 'Business settings', subtitle: 'Set company identity, billing defaults, localization and customer-facing preferences.', table: 'system_settings', order: ['key', true], searchKey: 'key',
    columns: [{ label: 'Setting', key: 'key' }, { label: 'Value', render: (r) => String(r.value ?? '') }, { label: 'Updated', render: (r) => dateFmt(r.updated_at) }],
    fields: [{ key: 'key', label: 'Setting key', required: true }, { key: 'value', label: 'Value', type: 'textarea' }, { key: 'description', label: 'Description' }],
  },
}

function AuditLog() {
  const list = usePaged({ table: 'activity_logs', select: '*, actor:profiles(full_name,email)', order: ['created_at', false] })
  return <div><div className="page-head"><div><h1>Audit log</h1><p>Recent business and administrative changes. Entries are read-only.</p></div></div>
    <DataTable rows={list.rows} loading={list.loading} cols={[{ label: 'Time', render: (r) => dateFmt(r.created_at) }, { label: 'User', render: (r) => r.actor?.full_name || r.actor?.email || 'System' }, { label: 'Action', key: 'action' }, { label: 'Module', key: 'module' }, { label: 'Record', render: (r) => r.record_id || '—' }, { label: 'Details', render: (r) => JSON.stringify(r.metadata || {}) }]} />
    <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
  </div>
}

function NotificationLog() {
  const [status, setStatus] = useState('')
  const [toast, show] = useToast()
  const list = usePaged({ table: 'notifications', select: '*, customer:profiles(full_name,email)', order: ['created_at', false], apply: (q) => status ? q.eq('delivery_status', status) : q, deps: [status] })
  async function retry(row) {
    const { error } = await supabase.from('notifications').update({ delivery_status: 'queued' }).eq('id', row.id)
    if (error) show(error.message, 'err'); else { show('Notification returned to the delivery queue'); list.reload() }
  }
  return <div><div className="page-head"><div><h1>Notification delivery log</h1><p>In-app events are visible in the customer portal. Email and other channels remain queued until a provider worker is configured.</p></div></div><div className="toolbar"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All delivery states</option>{['queued','sent','failed','read'].map((x) => <option key={x}>{x}</option>)}</select></div>{list.error && <p className="err">Could not load notifications: {list.error.message}</p>}<DataTable rows={list.rows} loading={list.loading} cols={[{ label: 'Created', render: (r) => dateFmt(r.created_at) }, { label: 'Customer', render: (r) => r.customer?.full_name || r.customer?.email || '—' }, { label: 'Event', key: 'event_key' }, { label: 'Channel', key: 'channel' }, { label: 'Message', key: 'subject' }, { label: 'Status', key: 'delivery_status' }, { label: '', right: true, render: (r) => r.delivery_status === 'failed' ? <button className="link" onClick={() => retry(r)}>Retry</button> : null }]} /><Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} /><Toast toast={toast} /></div>
}

export default function AdminModules({ module }) {
  if (module === 'audit') return <AuditLog />
  if (module === 'quotes') return <AdminQuotations />
  if (module === 'support') return <SupportTickets />
  if (module === 'automation') return <AutomationCenter />
  if (module === 'notificationLog') return <NotificationLog />
  const c = config[module]
  return <CrudPage {...c} />
}
