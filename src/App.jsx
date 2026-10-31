import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { passwordError } from './lib/format'
import Landing from './Landing'
import Workspace from './Workspace'

function ResetPassword() {
  const { updatePassword } = useAuth()
  const [msg, setMsg] = useState('')
  async function submit(e) {
    e.preventDefault()
    const pw = new FormData(e.currentTarget).get('password')
    const bad = passwordError(pw)
    if (bad) return setMsg(bad)
    const { error } = await updatePassword(pw)
    if (error) setMsg(error.message)
  }
  return (
    <div className="modal-overlay">
      <div className="auth-modal">
        <div className="modal-logo">∞</div>
        <h2>Choose a new password</h2>
        <form onSubmit={submit}>
          <div className="form-group"><label>New password</label><input name="password" type="password" required /></div>
          <p className="password-hint">More than 8 characters, with uppercase, lowercase and a special character.</p>
          {msg && <div className="form-message" style={{ background: '#fdecec', color: '#b42318' }}>{msg}</div>}
          <button className="primary-btn auth-submit">Update password →</button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const { session, profile, loading, recovery } = useAuth()
  if (loading) return <div className="boot">Loading…</div>
  if (recovery) return <ResetPassword />
  if (session && profile) return <Workspace />
  return <Landing />
}
