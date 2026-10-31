export const money = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n || 0))

export const dateFmt = (d) =>
  d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const today = () => new Date().toISOString().slice(0, 10)

// Password rule from the brief: more than 8 chars, upper, lower, special
export function passwordError(pw) {
  if (pw.length <= 8) return 'Password must be more than 8 characters.'
  if (!/[A-Z]/.test(pw)) return 'Add at least one uppercase letter.'
  if (!/[a-z]/.test(pw)) return 'Add at least one lowercase letter.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Add at least one special character.'
  return ''
}

export const isOverdue = (inv) =>
  inv.status === 'confirmed' && inv.due_date < today() && Number(inv.amount_paid) < Number(inv.total)
