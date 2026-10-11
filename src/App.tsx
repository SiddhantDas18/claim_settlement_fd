import { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'
import { Spinner } from './components/ui'
import ClaimPage from './pages/admin/ClaimPage'
import Inbox from './pages/admin/Inbox'
import Settings from './pages/admin/Settings'
import TestCases from './pages/admin/TestCases'
import ClaimWizard from './pages/claimant/ClaimWizard'
import MyClaims from './pages/claimant/MyClaims'
import Login from './pages/Login'
import { navigate, useRoute } from './router'
import type { User } from './types'

const ADMIN_NAV = [
  { path: 'claims', label: 'Claims' },
  { path: 'test-cases', label: 'Test cases' },
  { path: 'settings', label: 'Settings' },
]
const CLAIMANT_NAV = [{ path: 'my-claims', label: 'My claims' }]

function Page({ user, route }: { user: User; route: string[] }) {
  const [section, id] = route
  if (user.role === 'admin') {
    if (section === 'claim' && id) return <ClaimPage key={id} id={Number(id)} />
    if (section === 'test-cases') return <TestCases />
    if (section === 'settings') return <Settings />
    const tab = id === 'pay' || id === 'history' ? id : 'review'
    return <Inbox tab={tab} />
  }
  if (section === 'claim' && id === 'new') return <ClaimWizard key="new" id={null} />
  if (section === 'claim' && id) return <ClaimWizard key={id} id={Number(id)} />
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
  const section = route[0] === 'claim' ? (user.role === 'admin' ? 'claims' : 'my-claims') : route[0] ?? nav[0].path

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden>✚</span>Claim Intake</div>
        <nav className="nav">
          {nav.map((item) => <a key={item.path} href={`#/${item.path}`} className={section === item.path ? 'active' : ''}>{item.label}</a>)}
        </nav>
        <div className="user-box">
          <span>{user.full_name}</span>
          <button className="small" onClick={() => { setToken(null); setUser(null); navigate('/') }}>Log out</button>
        </div>
      </header>
      <main><Page user={user} route={route} /></main>
    </div>
  )
}
