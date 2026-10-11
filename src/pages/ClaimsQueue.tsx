import { useEffect, useState } from 'react'
import { api } from '../api'
import { Card, ClaimStatusBadge, Notice, Spinner, TriageChip } from '../components/ui'
import { date, humanize, money } from '../format'
import { navigate } from '../router'
import type { Claim, ClaimStatus, TriageCategory, User } from '../types'

const STATUSES: ClaimStatus[] = ['submitted', 'draft', 'approved', 'rejected', 'paid']
const TRIAGES: TriageCategory[] = ['conflicting_information', 'needs_more_information', 'possible_issue', 'ready_for_review']

export default function ClaimsQueue() {
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [users, setUsers] = useState<Record<number, User>>({})
  const [status, setStatus] = useState<string>('submitted')
  const [triage, setTriage] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    const query = status ? `?status=${status}` : ''
    api.get<Claim[]>(`/api/v1/admin/claims${query}`).then(setClaims).catch((e) => setError(e.message))
  }, [status])

  useEffect(() => {
    api.get<User[]>('/api/v1/admin/users').then((list) => setUsers(Object.fromEntries(list.map((u) => [u.id, u])))).catch(() => {})
  }, [])

  const shown = (claims ?? []).filter((c) => !triage || c.triage_category === triage)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Claims queue</h1>
          <p>Submitted claims are analysed automatically. Triage is a system recommendation, not a decision.</p>
        </div>
        <div className="row">
          <label className="field">
            Status
            <select value={status} onChange={(e) => { setClaims(null); setStatus(e.target.value) }}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </label>
          <label className="field">
            Triage
            <select value={triage} onChange={(e) => setTriage(e.target.value)}>
              <option value="">All</option>
              {TRIAGES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </label>
        </div>
      </div>
      <Notice kind="error">{error}</Notice>
      <Card flush>
        {claims === null ? (
          <div className="empty"><Spinner /></div>
        ) : shown.length === 0 ? (
          <div className="empty">No claims match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Claimant</th>
                  <th>Status</th>
                  <th>Triage (system)</th>
                  <th>Treatment</th>
                  <th className="num">Claimed</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="clickable" tabIndex={0} onClick={() => navigate(`/claims/${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/claims/${c.id}`)}>
                    <td><strong>#{c.id}</strong><div className="muted small">{c.invoice_number ?? 'no invoice no.'}</div></td>
                    <td>{users[c.user_id]?.full_name ?? `User ${c.user_id}`}</td>
                    <td><ClaimStatusBadge status={c.status} /></td>
                    <td><TriageChip value={c.triage_category} /></td>
                    <td className="small">{date(c.treatment_start)} – {date(c.treatment_end)}</td>
                    <td className="num">{money(c.claimed_amount)}</td>
                    <td className="small">{date(c.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
