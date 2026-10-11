import { useState, type FormEvent } from 'react'
import { api, setToken } from '../api'
import { Notice } from '../components/ui'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'register') {
        await api.post('/api/v1/auth/register', { email, password, full_name: fullName })
        setInfo('Account created. An admin must add a policy for you before you can file a claim.')
      }
      const { access_token } = await api.post<{ access_token: string }>('/api/v1/auth/login', { email, password })
      setToken(access_token)
      onLogin()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="card-head">
          <span className="brand-mark" aria-hidden>✚</span>
          <h1>Claim Intake Assistant</h1>
        </div>
        <form className="card-body" onSubmit={submit}>
          <p className="muted small">
            AI-assisted health-claim intake: extracts facts with quotes, marks what is missing, flags contradictions.
          </p>
          {mode === 'register' && (
            <label className="field">
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="field">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>
          <Notice kind="error">{error}</Notice>
          <Notice kind="success">{info}</Notice>
          <button className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'New claimant? Create an account' : 'Already have an account? Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
