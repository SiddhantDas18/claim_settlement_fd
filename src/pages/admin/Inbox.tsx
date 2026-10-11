import { useEffect, useState } from 'react'
import { api } from '../../api'
import { ClaimStatusBadge, Notice, Spinner, TriageChip } from '../../components/ui'
import { date, money } from '../../format'
import { navigate } from '../../router'
import type { Claim, User } from '../../types'

type Tab = 'review' | 'pay' | 'history'
const TABS: { id: Tab; label: string; statuses: string[]; empty: string }[] = [
  { id: 'review', label: 'To review', statuses: ['submitted'], empty: 'No claims waiting for review.' },
  { id: 'pay', label: 'To pay', statuses: ['approved'], empty: 'Nothing waiting to be paid.' },
  { id: 'history', label: 'History', statuses: ['paid', 'rejected'], empty: 'No finished claims yet.' },
]

export default function Inbox({ tab }: { tab: Tab }) {
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [users, setUsers] = useState<Record<number, User>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Claim[]>('/api/v1/admin/claims').then(setClaims).catch((e) => setError(e.message))
    api.get<User[]>('/api/v1/admin/users').then((list) => setUsers(Object.fromEntries(list.map((u) => [u.id, u])))).catch(() => {})
  }, [])

  const name = (c: Claim) => users[c.user_id]?.full_name ?? `User ${c.user_id}`
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const q = search.trim().toLowerCase()
  const shown = (claims ?? [])
    .filter((c) => current.statuses.includes(c.status))
    .filter((c) => !q || `${name(c)} #${c.id} ${c.invoice_number ?? ''} ${c.hospital_name ?? ''}`.toLowerCase().includes(q))

  return (
    <div className="page narrow">
      <div className="page-head">
        <div><h1>Claims</h1><p>Each submitted claim is checked automatically. Open one to decide.</p></div>
        <input type="search" placeholder="Search name, claim #, invoice…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} aria-label="Search claims" />
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === current.id} className={`tab${t.id === current.id ? ' active' : ''}`} onClick={() => navigate(`/claims/${t.id}`)}>
            {t.label}<span className="count">{claims ? claims.filter((c) => t.statuses.includes(c.status)).length : '·'}</span>
          </button>
        ))}
      </div>
      <Notice kind="error">{error}</Notice>
      <section className="block">
        {claims === null ? (
          <div className="empty"><Spinner /></div>
        ) : shown.length === 0 ? (
          <div className="empty">{search ? 'No claims match your search.' : current.empty}</div>
        ) : (
          <div className="inbox">
            {shown.map((c) => (
              <button key={c.id} className="inbox-row" onClick={() => navigate(`/claim/${c.id}`)}>
                <span>
                  <span className="who">{name(c)}</span>
                  <span className="muted small"> · #{c.id}</span>
                  {c.hospital_name && <div className="muted small">{c.hospital_name}</div>}
                </span>
                <span className="amount">{money(c.status === 'submitted' ? c.claimed_amount : c.approved_amount ?? c.claimed_amount)}</span>
                <span className="status-cell" style={{ minWidth: 0 }}>
                  {tab === 'history' ? <ClaimStatusBadge status={c.status} /> : <TriageChip value={c.triage_category} />}
                  {tab === 'review' && c.triage_reason && <div className="reason">{c.triage_reason}</div>}
                  {tab === 'pay' && <div className="reason">Approved, waiting for payment</div>}
                </span>
                <span className="muted small when">{date(c.submitted_at)}</span>
                <span className="chev" aria-hidden>›</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
