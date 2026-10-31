import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { passwordError } from '../lib/format'

const COPY = {
  login:  ['Welcome back.', 'Log in to continue managing your subscriptions.', 'Log In'],
  signup: ['Create your account.', 'Get started with smarter subscription management.', 'Create Account'],
  forgot: ['Reset your password.', "Enter your registered email and we'll send you a reset link.", 'Send Reset Link'],
}

export default function AuthModal({ mode, setMode, onClose }) {
  const { signIn, signUp, sendReset, configured } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // {type:'error'|'ok', text}

  const go = (m) => { setMode(m); setMsg(null) }

  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = f.get('email').trim().toLowerCase()
    const password = f.get('password') || ''
    if (!configured) {
      return setMsg({ type: 'error', text: 'Add your Supabase URL and anon key to the .env file, then restart npm run dev.' })
    }
    if (mode === 'signup') {
      const err = passwordError(password)
      if (err) return setMsg({ type: 'error', text: err })
    }
    setBusy(true); setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        onClose()
      } else if (mode === 'signup') {
        const { data, error } = await signUp(email, password, f.get('fullname'))
        if (error) throw error
        if (data.user && data.user.identities?.length === 0) throw new Error('An account with this email already exists.')
        if (data.session) onClose()
        else setMsg({ type: 'ok', text: 'Account created! Check your email to confirm it, then log in.' })
      } else {
        const { error } = await sendReset(email)
        if (error) throw error
        setMsg({ type: 'ok', text: 'If that email is registered, a reset link is on its way.' })
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally { setBusy(false) }
  }

  const [title, desc, cta] = COPY[mode]
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        <div className="modal-logo">∞</div>
        <span className="eyebrow">WELCOME TO BRIGHTLOOP</span>
        <h2>{title}</h2>
        <p className="modal-description">{desc}</p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="fullname">Full name</label>
              <input id="fullname" name="fullname" type="text" placeholder="Enter your full name" required />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          {mode !== 'forgot' && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" placeholder="Enter your password" required />
            </div>
          )}
          {mode === 'signup' && (
            <p className="password-hint">Use more than 8 characters, including uppercase, lowercase and a special character.</p>
          )}
          {mode === 'login' && (
            <div className="auth-switch" style={{ marginTop: 0 }}>
              <button type="button" onClick={() => go('forgot')}>Forgot password?</button>
            </div>
          )}
          {msg && (
            <div className="form-message" style={msg.type === 'error' ? { background: '#fdecec', color: '#b42318' } : undefined}>
              {msg.text}
            </div>
          )}
          <button className="primary-btn auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : cta} →
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signup' ? 'Already have an account?' : mode === 'login' ? "Don't have an account?" : 'Remembered it?'}
          <button onClick={() => go(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Sign Up' : 'Log In'}
          </button>
        </div>
        <p className="modal-terms">By continuing, you agree to Brightloop's terms and privacy policy.</p>
      </div>
    </div>
  )
}
