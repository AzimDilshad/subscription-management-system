import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="ad-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'ad-modal' + (wide ? ' wide' : '')}>
        <div className="ad-modal-head">
          <h3>{title}</h3>
          <button className="ad-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="ad-modal-body">{children}</div>
      </div>
    </div>
  )
}

export const Badge = ({ value, tone }) => (
  <span className={`badge ${tone || value}`}>{String(value).replace('_', ' ')}</span>
)

export function Field({ label, children, hint }) {
  return (
    <label className="fld">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Pager({ page, setPage, count, size }) {
  const pages = Math.max(1, Math.ceil(count / size))
  return (
    <div className="pager">
      <span>{count} record{count === 1 ? '' : 's'}</span>
      <div>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Prev</button>
        <b>{page + 1} / {pages}</b>
        <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
      </div>
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return <div className={'toast ' + toast.type}>{toast.text}</div>
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const show = (text, type = 'ok') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }
  return [toast, show]
}

/** Server-side paginated query: only one page of rows is ever loaded → stays fast with thousands of rows. */
export function usePaged({ table, select = '*', apply, order = ['created_at', false], size = 15, deps = [] }) {
  const [page, setPage] = useState(0)
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ rows: [], count: 0, loading: true, error: null })
  const depKey = JSON.stringify(deps)

  useEffect(() => { setPage(0) }, [depKey])

  useEffect(() => {
    let off = false
    ;(async () => {
      setState((s) => ({ ...s, loading: true }))
      let q = supabase.from(table).select(select, { count: 'exact' })
      if (apply) q = apply(q)
      q = q.order(order[0], { ascending: order[1] }).range(page * size, page * size + size - 1)
      const { data, count, error } = await q
      if (!off) setState({ rows: data || [], count: count || 0, loading: false, error })
    })()
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, page, size, tick, depKey])

  return { ...state, page, setPage, size, reload: () => setTick((t) => t + 1) }
}

export function useOptions(table, label = 'name', extra = '', filter) {
  const [opts, setOpts] = useState([])
  useEffect(() => {
    if (table === '_') return
    let q = supabase.from(table).select(`id, ${label}${extra ? ',' + extra : ''}`).limit(500)
    if (filter) q = filter(q)
    q.then(({ data }) => setOpts(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])
  return opts
}

export function DataTable({ cols, rows, loading, empty = 'Nothing here yet.', onRow }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c.label} className={c.right ? 'r' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {loading && rows.length === 0 && <tr><td colSpan={cols.length} className="muted">Loading…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={cols.length} className="muted">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={onRow ? 'click' : ''} onClick={() => onRow?.(r)}>
              {cols.map((c) => <td key={c.label} className={c.right ? 'r' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
