import { useCallback, useEffect, useState } from 'react'
import { api, setToken, getToken } from './api'
import { Spinner } from './components/ui'
import AdminPolicies from './pages/AdminPolicies'
import ClaimEditor from './pages/ClaimEditor'
import ClaimReview from './pages/ClaimReview'
import ClaimsQueue from './pages/ClaimsQueue'
import Login from './pages/Login'
import MyClaims from './pages/MyClaims'
import Payments from './pages/Payments'
import Playground from './pages/Playground'
import { navigate, useRoute } from './router'
import type { User } from './types'

const ADMIN_NAV = [
  { path: 'analyze', label: 'Analyze' },
  { path: 'claims', label: 'Claims queue' },
  { path: 'payments', label: 'Payments' },
  { path: 'policies', label: 'Users & policies' },
]
const CLAIMANT_NAV = [{ path: 'my-claims', label: 'My claims' }]

function Page({ user, route }: { user: User; route: string[] }) {
  const [section, id] = route
  if (user.role === 'admin') {
    if (section === 'claims' && id) return <ClaimReview key={id} id={Number(id)} />
    if (section === 'claims') return <ClaimsQueue />
    if (section === 'payments') return <Payments />
    if (section === 'policies') return <AdminPolicies />
    return <Playground />
  }
  if (section === 'my-claims' && id === 'new') return <ClaimEditor key="new" id={null} />
  if (section === 'my-claims' && id) return <ClaimEditor key={id} id={Number(id)} />
  return <MyClaims />
}

export default function App() {
  const route = useRoute()
  const [user, setUser] = useState<User | null | undefined>(getToken() ? undefined : null)

  const loadUser = useCallback(() => {
    api.get<User>('/api/v1/auth/me').then(setUser).catch(() => {
      setToken(null)
      setUser(null)
    })
  }, [])

  useEffect(() => {
    if (getToken()) loadUser()
  }, [loadUser])

  if (user === undefined) return <div className="login-wrap"><Spinner /></div>
  if (user === null) return <Login onLogin={loadUser} />

  const nav = user.role === 'admin' ? ADMIN_NAV : CLAIMANT_NAV
  const active = route[0] ?? nav[0].path

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden>✚</span>Claim Intake Assistant</div>
        <nav className="nav">
          {nav.map((item) => (
            <a key={item.path} href={`#/${item.path}`} className={active === item.path ? 'active' : ''}>{item.label}</a>
          ))}
        </nav>
        <div className="user-box">
          <span>{user.full_name} · {user.role}</span>
          <button className="small" onClick={() => { setToken(null); setUser(null); navigate('/') }}>Log out</button>
        </div>
      </header>
      <main><Page user={user} route={route} /></main>
    </div>
  )
}
