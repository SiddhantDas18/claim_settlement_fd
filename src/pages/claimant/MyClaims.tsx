import { useEffect, useState } from 'react'
import { api } from '../../api'
import { Notice, Spinner } from '../../components/ui'
import { date, money } from '../../format'
import { navigate } from '../../router'
import type { Claim, Policy } from '../../types'
import Progress from './Progress'

export default function MyClaims() {
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [policies, setPolicies] = useState<Policy[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const load = () => {
      api.get<Claim[]>('/api/v1/claims').then(setClaims).catch((e) => setError(e.message))
      api.get<Policy[]>('/api/v1/policies').then(setPolicies).catch(() => setPolicies([]))
    }
    load()
    // Refresh when the claimant comes back to the tab: a policy may have been added or a claim decided meanwhile.
    const onVisible = () => document.visibilityState === 'visible' && load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <div className="page narrow">
      <div className="page-head">
        <div><h1>My claims</h1><p>Claim back your hospital costs in three steps.</p></div>
        <button className="primary" disabled={!policies?.length} onClick={() => navigate('/claim/new')}>+ New claim</button>
      </div>
      <Notice kind="error">{error}</Notice>
      {policies && policies.length === 0 && (
        <Notice kind="info">Your account doesn't have an insurance policy linked yet. The insurer will add it; after that you can file a claim here.</Notice>
      )}
      {claims === null ? (
        <div className="empty"><Spinner /></div>
      ) : claims.length === 0 ? (
        <section className="block"><div className="empty">You haven't made any claims yet.</div></section>
      ) : (
        claims.map((c) => (
          <button key={c.id} className="block claim-card" onClick={() => navigate(`/claim/${c.id}`)}>
            <div className="title-row">
              <strong>{c.hospital_name ?? 'Hospital stay'}</strong>
              <span className="muted small">#{c.id} · {date(c.treatment_start)} – {date(c.treatment_end)}</span>
              <span className="spacer" />
              <strong>{money(c.status === 'paid' || c.status === 'approved' ? c.approved_amount : c.claimed_amount)}</strong>
            </div>
            {c.status === 'draft' ? (
              <span className="row small"><span className="badge neutral">Draft</span> Not submitted yet. Tap to continue.</span>
            ) : (
              <Progress claim={c} />
            )}
            {c.status === 'rejected' && c.admin_note && <span className="small">Reason: {c.admin_note}</span>}
          </button>
        ))
      )}
    </div>
  )
}
