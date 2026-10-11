import { useEffect, useState } from 'react'
import { api } from '../api'
import { Card, ClaimStatusBadge, Notice, Spinner } from '../components/ui'
import { date, money } from '../format'
import { navigate } from '../router'
import type { Claim } from '../types'

export default function MyClaims() {
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.get<Claim[]>('/api/v1/claims').then(setClaims).catch((e) => setError(e.message))
  }, [])
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>My claims</h1><p>Create a claim, upload your hospital documents, then submit it for review.</p></div>
        <button className="primary" onClick={() => navigate('/my-claims/new')}>+ New claim</button>
      </div>
      <Notice kind="error">{error}</Notice>
      <Card flush>
        {claims === null ? (
          <div className="empty"><Spinner /></div>
        ) : claims.length === 0 ? (
          <div className="empty">You have no claims yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Claim</th><th>Status</th><th>Treatment</th><th>Documents</th><th className="num">Claimed</th><th className="num">Approved</th></tr></thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className="clickable" tabIndex={0} onClick={() => navigate(`/my-claims/${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/my-claims/${c.id}`)}>
                    <td><strong>#{c.id}</strong> <span className="muted small">{c.invoice_number}</span></td>
                    <td><ClaimStatusBadge status={c.status} /></td>
                    <td className="small">{date(c.treatment_start)} – {date(c.treatment_end)}</td>
                    <td>{c.documents.length}</td>
                    <td className="num">{money(c.claimed_amount)}</td>
                    <td className="num">{money(c.approved_amount)}</td>
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
