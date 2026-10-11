import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import AnalysisView from '../components/AnalysisView'
import Documents from '../components/Documents'
import { Card, ClaimStatusBadge, Notice, Spinner } from '../components/ui'
import { date, dateTime, money } from '../format'
import { navigate } from '../router'
import type { Calculation, Claim, ClaimAnalysis } from '../types'

export default function ClaimReview({ id }: { id: number }) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null | undefined>(undefined)
  const [calc, setCalc] = useState<Calculation | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [override, setOverride] = useState('')

  const load = useCallback(async () => {
    try {
      setClaim(await api.get<Claim>(`/api/v1/admin/claims/${id}`))
      api.get<Calculation>(`/api/v1/admin/claims/${id}/calculation`).then(setCalc).catch(() => setCalc(null))
      try {
        setAnalysis(await api.get<ClaimAnalysis>(`/api/v1/admin/claims/${id}/analysis`))
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setAnalysis(null)
        else throw err
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: string, fn: () => Promise<unknown>, done: string) {
    setBusy(action)
    setError('')
    setMessage('')
    try {
      await fn()
      setMessage(done)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('')
    }
  }

  if (error && !claim) return <div className="page"><Notice kind="error">{error}</Notice></div>
  if (!claim) return <div className="page"><div className="empty"><Spinner /></div></div>

  const canDecide = claim.status === 'submitted'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="link" onClick={() => navigate('/claims')}>← Claims queue</button>
          <h1 style={{ marginTop: 6 }}>Claim #{claim.id} <ClaimStatusBadge status={claim.status} /></h1>
          <p>Submitted {dateTime(claim.submitted_at)} · Claimed {money(claim.claimed_amount)}</p>
        </div>
        <button
          disabled={!!busy}
          onClick={() => run('analyze', () => api.post(`/api/v1/admin/claims/${id}/analyze`), 'Analysis re-run and saved.')}
        >
          {busy === 'analyze' ? 'Re-running analysis…' : 'Re-run analysis'}
        </button>
      </div>
      <Notice kind="error">{error}</Notice>
      <Notice kind="success">{message}</Notice>

      <div className="analysis-grid">
        <Card title="Claim form (typed by the claimant)">
          <dl className="kv">
            <dt>Invoice number</dt><dd>{claim.invoice_number ?? <span className="value-missing">not given</span>}</dd>
            <dt>Treatment</dt><dd>{date(claim.treatment_start)} – {date(claim.treatment_end)}</dd>
            <dt>Description</dt><dd>{claim.description ?? '-'}</dd>
            <dt>Expense items</dt>
            <dd>{claim.items.map((i) => `${i.description} (${i.category}) ${money(i.amount)}`).join(' · ') || '-'}</dd>
            {claim.admin_note && (<><dt>Admin note</dt><dd>{claim.admin_note}</dd></>)}
            {claim.approved_amount !== null && (<><dt>Approved</dt><dd>{money(claim.approved_amount)}</dd></>)}
          </dl>
        </Card>
        <Card title={`Documents (${claim.documents.length})`}>
          <Documents claimId={claim.id} documents={claim.documents} />
        </Card>
      </div>

      <h2>Intake analysis</h2>
      {busy === 'analyze' && <Card><div className="row"><Spinner /> The AI is re-reading every document…</div></Card>}
      {analysis === undefined && <div className="empty"><Spinner /></div>}
      {analysis === null && (
        <Card><div className="empty">No analysis yet. Analyses run when a claim is submitted, or press “Re-run analysis”.</div></Card>
      )}
      {analysis && busy !== 'analyze' && <AnalysisView analysis={analysis} />}

      <h2>Settlement</h2>
      <div className="analysis-grid">
        <Card title="Calculation" hint={calc ? `Plan rules, ${calc.currency}` : undefined} flush>
          {!calc ? (
            <div className="empty"><Spinner /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Item</th><th className="num">Claimed</th><th className="num">Covered</th><th>Rule</th></tr></thead>
                <tbody>
                  {calc.lines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.description} <span className="muted small">({line.category})</span></td>
                      <td className="num">{money(line.claimed)}</td>
                      <td className="num">{money(line.covered)}</td>
                      <td className="small muted">{line.note}</td>
                    </tr>
                  ))}
                  <tr><td>Total</td><td className="num">{money(calc.total_claimed)}</td><td className="num">{money(calc.total_covered)}</td><td /></tr>
                  <tr><td>Deductible</td><td /><td className="num">−{money(calc.deductible)}</td><td /></tr>
                  <tr><td>Remaining annual limit</td><td /><td className="num">{money(calc.remaining_limit)}</td><td /></tr>
                  <tr><td><strong>Payable</strong></td><td /><td className="num"><strong>{money(calc.payable)}</strong></td><td /></tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Decision">
          {!canDecide ? (
            <p className="muted">This claim is {claim.status}; only submitted claims can be approved or rejected.</p>
          ) : (
            <>
              <label className="field">Note (required to reject or to override the amount)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ fontFamily: 'inherit', minHeight: 70 }} /></label>
              <label className="field">Override payable amount (₹, optional)<input type="number" min="0" step="0.01" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={calc ? String(calc.payable) : ''} /></label>
              <div className="row">
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => run('approve', () => api.post(`/api/v1/admin/claims/${id}/approve`, { note: note || null, override_amount: override === '' ? null : Number(override) }), 'Claim approved. A pending payment was created.')}
                >
                  Approve
                </button>
                <button
                  className="danger"
                  disabled={!!busy || !note.trim()}
                  onClick={() => run('reject', () => api.post(`/api/v1/admin/claims/${id}/reject`, { note }), 'Claim rejected.')}
                >
                  Reject
                </button>
              </div>
              {analysis && analysis.recommendations.triage_category.value !== 'ready_for_review' && (
                <Notice kind="warn">The analysis recommends “{analysis.recommendations.triage_category.value.replaceAll('_', ' ')}”. Check the next steps before deciding.</Notice>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
