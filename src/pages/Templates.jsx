import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CrudPage from '../components/CrudPage'
import { Modal, useOptions } from '../components/ui'

function Lines({ tpl, onClose, reload }) {
  const products = useOptions('products')
  const [lines, setLines] = useState(tpl.lines || [])
  const save = async () => {
    await supabase.from('quotation_templates').update({ lines }).eq('id', tpl.id)
    reload(); onClose()
  }
  return (
    <Modal title={`Lines — ${tpl.name}`} onClose={onClose}>
      {lines.map((l, i) => (
        <div className="inline-form" key={i}>
          <select value={l.product_id} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}>
            <option value="">Product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min="1" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} />
          <button className="link danger" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div className="form-actions">
        <button className="btn ghost" onClick={() => setLines([...lines, { product_id: '', quantity: 1 }])}>+ Add line</button>
        <button className="btn" onClick={save}>Save lines</button>
      </div>
    </Modal>
  )
}

export default function Templates() {
  const [t, setT] = useState(null)
  const [n, force] = useState(0)
  return (
    <>
      <CrudPage
        title="Quotation templates" subtitle="Start a quote from a ready-made plan + product lines."
        table="quotation_templates" select="*, plan:plans(name)" order={['name', true]}
        columns={[
          { label: 'Name', key: 'name' }, { label: 'Plan', render: (r) => r.plan?.name || '—' },
          { label: 'Valid for', render: (r) => r.validity_days + ' days' },
          { label: 'Lines', render: (r) => (r.lines || []).length },
        ]}
        fields={[
          { key: 'name', label: 'Template name', required: true },
          { key: 'plan_id', label: 'Plan', type: 'select', from: { table: 'plans' } },
          { key: 'validity_days', label: 'Valid for (days)', type: 'number', required: true, default: 30 },
        ]}
        rowActions={(r) => <button onClick={() => setT(r)}>Lines</button>}
        key={n}
      />
      {t && <Lines tpl={t} onClose={() => setT(null)} reload={() => force((n) => n + 1)} />}
    </>
  )
}
