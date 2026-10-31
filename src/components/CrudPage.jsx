import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Field, Pager, DataTable, usePaged, useOptions, useToast, Toast } from './ui'

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
    else if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const headers = (rows.shift() || []).map((x) => x.trim())
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])))
}

function SelectField({ f, value, onChange }) {
  const dyn = useOptions(f.from?.table || '_', f.from?.label || 'name')
  const options = f.options || dyn.map((o) => ({ value: o.id, label: o[f.from.label || 'name'] }))
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={f.required}>
      <option value="">{f.required ? 'Select…' : '— none —'}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Input({ f, value, onChange }) {
  if (f.type === 'select') return <SelectField f={f} value={value} onChange={onChange} />
  if (f.type === 'checkbox')
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
  if (f.type === 'textarea')
    return <textarea rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  return (
    <input
      type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined}
      value={value ?? ''} required={f.required}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** One config-driven list + create/edit/delete screen. Used for products, plans, taxes, discounts, templates. */
export default function CrudPage({ title, subtitle, table, select = '*', columns, fields, rowActions, searchKey = 'name', order, canDelete = true, canImport = false }) {
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null) // null | {} (new) | row
  const [toast, show] = useToast()
  const list = usePaged({ table, select, order, apply: (query) => (q ? query.ilike(searchKey, `%${q}%`) : query), deps: [q] })

  const blank = Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === 'checkbox' ? false : '')]))

  async function exportCsv() {
    const names = fields.map((f) => f.key)
    const all = []
    for (let page = 0; page < 20; page += 1) {
      let query = supabase.from(table).select(names.join(','))
      if (q) query = query.ilike(searchKey, `%${q}%`)
      query = query.order(order?.[0] || 'created_at', { ascending: order?.[1] ?? false }).range(page * 500, page * 500 + 499)
      const { data, error } = await query
      if (error) return show(error.message, 'err')
      all.push(...(data || []))
      if ((data || []).length < 500) break
    }
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const text = [names.map(quote).join(','), ...all.map((row) => names.map((name) => quote(row[name])).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${table}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  async function importCsv(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const rows = parseCsv(await file.text())
    if (!rows.length) return show('The CSV has no data rows.', 'err')
    const allowed = new Set(fields.map((f) => f.key))
    const payload = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)).map(([key, value]) => {
      const field = fields.find((f) => f.key === key)
      if (field?.type === 'number') return [key, value === '' ? null : Number(value)]
      if (field?.type === 'checkbox') return [key, value.toLowerCase() === 'true' || value === '1']
      return [key, value === '' ? null : value]
    })))
    if (payload.some((row) => !row.name)) return show('Each imported row needs a name column.', 'err')
    const { error } = await supabase.from(table).insert(payload)
    if (error) return show(error.message, 'err')
    show(`${payload.length} records imported`); list.reload()
  }

  async function save(e) {
    e.preventDefault()
    const payload = {}
    for (const f of fields) {
      let v = edit[f.key]
      if (f.type === 'number') v = v === '' || v == null ? (f.required ? 0 : null) : Number(v)
      else if (v === '') v = null
      payload[f.key] = v
    }
    const res = edit.id
      ? await supabase.from(table).update(payload).eq('id', edit.id)
      : await supabase.from(table).insert(payload)
    if (res.error) return show(res.error.message, 'err')
    show('Saved'); setEdit(null); list.reload()
  }

  async function remove(row) {
    if (!window.confirm('Delete this record?')) return
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (error) return show(error.message, 'err')
    show('Deleted'); list.reload()
  }

  const cols = [
    ...columns,
    {
      label: '', right: true,
      render: (r) => (
        <span className="row-actions" onClick={(e) => e.stopPropagation()}>
          {rowActions?.(r, list.reload, show)}
          <button onClick={() => setEdit({ ...r })}>Edit</button>
          {canDelete && <button className="danger" onClick={() => remove(r)}>Delete</button>}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="page-head">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        <div className="head-actions">{canImport && <label className="btn ghost">Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={importCsv} /></label>}<button className="btn ghost" onClick={exportCsv}>Export CSV</button><button className="btn" onClick={() => setEdit({ ...blank })}>+ New</button></div>
      </div>
      <div className="toolbar">
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <DataTable cols={cols} rows={list.rows} loading={list.loading} />
      <Pager page={list.page} setPage={list.setPage} count={list.count} size={list.size} />
      {edit && (
        <Modal title={(edit.id ? 'Edit ' : 'New ') + title.replace(/s$/, '')} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} label={f.label + (f.required ? ' *' : '')} hint={f.hint}>
                <Input f={f} value={edit[f.key]} onChange={(v) => setEdit({ ...edit, [f.key]: v })} />
              </Field>
            ))}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn">Save</button>
            </div>
          </form>
        </Modal>
      )}
      <Toast toast={toast} />
    </div>
  )
}
