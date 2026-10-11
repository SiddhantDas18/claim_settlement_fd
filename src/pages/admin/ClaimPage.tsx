import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, openDocument } from '../../api'
import ClaimSummary, { SourceTag } from '../../components/ClaimSummary'
import { ClaimStatusBadge, Notice, Spinner } from '../../components/ui'
import { date, dateTime, humanize, money } from '../../format'
import { navigate } from '../../router'
import type { Calculation, Claim, ClaimAnalysis, ClaimDocument, User } from '../../types'

const READ: Record<string, string> = { pdf_text: 'text read', pdf_ocr: 'scanned, OCR', image_ocr: 'photo, OCR', failed: 'could not read' }

function DocumentChips({ claim }: { claim: Claim }) {
  const [text, setText] = useState<ClaimDocument | null>(null)
  const [error, setError] = useState('')
  return (
    <div className="stack" style={{ gap: 8 }}>
      <strong className="small">Documents</strong>
      <div className="doc-chips">
        {claim.documents.length === 0 && <span className="muted small">None uploaded.</span>}
        {claim.documents.map((d) => (
          <span key={d.id} className="doc-chip">
            📄 <span>{humanize(d.doc_type)}</span>
            <span className={`small ${d.extraction_method === 'failed' ? 'value-conflict' : 'muted'}`}>({READ[d.extraction_method ?? ''] ?? 'not read'})</span>
            <button className="link small" onClick={() => openDocument(`/api/v1/claims/${claim.id}/documents/${d.id}/file`).catch((e) => setError(e.message))}>open</button>
            {d.extracted_text && <button className="link small" onClick={() => setText(text?.id === d.id ? null : d)}>text</button>}
          </span>
        ))}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {text && <div className="quote">{text.extracted_text}</div>}
    </div>
  )
}

function Decision({ claim, calc, ready, onChanged }: { claim: Claim; calc: Calculation | null; ready: boolean; onChanged: (message: string) => void }) {
  const [note, setNote] = useState('')
  const [override, setOverride] = useState('')
  const [method, setMethod] = useState('upi')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChanged(done)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  let body
  if (claim.status === 'draft') body = <p className="muted">The claimant hasn't submitted this claim yet.</p>
  else if (claim.status === 'rejected') body = <p><span className="badge bad">Rejected</span> {claim.admin_note}</p>
  else if (claim.status === 'paid')
    body = <p><span className="badge ok">✓ Paid</span> {money(claim.payment?.amount)} by {claim.payment?.method?.toUpperCase()} {claim.payment?.reference && `(ref ${claim.payment.reference})`} on {dateTime(claim.payment?.paid_at)}</p>
  else if (claim.status === 'approved')
    body = (
      <>
        <div className="payable"><span className="muted">Approved, to pay</span><span className="amount">{money(claim.approved_amount)}</span></div>
        {claim.payment ? (
          <div className="row">
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 'auto' }} aria-label="Payment method">
              <option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option>
            </select>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / UTR (optional)" style={{ maxWidth: 240 }} aria-label="Payment reference" />
            <button className="primary" disabled={busy} onClick={() => run(() => api.post(`/api/v1/admin/payments/${claim.payment!.id}/mark-paid`, { method, reference: reference || null }), 'Marked as paid.')}>Mark as paid</button>
          </div>
        ) : <p className="muted">Approved for {money(0)}: nothing to pay.</p>}
      </>
    )
  else
    body = (
      <>
        <div className="payable">
          <span className="muted">Payable</span>
          <span className="amount">{calc ? money(calc.payable) : <Spinner />}</span>
          {calc && <span className="muted small">of {money(calc.total_claimed)} claimed</span>}
        </div>
        {calc && (
          <details>
            <summary>How it's calculated</summary>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              <span className="row small muted">
                {calc.items_source === 'bill' ? <>Charges as read from the bill by the AI <SourceTag provenance="system_inferred" /></> : <>Charges as typed by the claimant <SourceTag provenance="claimant_form" /></>}
              </span>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {calc.lines.map((l, i) => (
                      <tr key={i}><td>{l.description} <span className="muted small">({l.category})</span></td><td className="num">{money(l.claimed)}</td><td className="num">{money(l.covered)}</td><td className="small muted">{l.note}</td></tr>
                    ))}
                    <tr><td>Covered</td><td className="num">{money(calc.total_claimed)}</td><td className="num">{money(calc.total_covered)}</td><td /></tr>
                    <tr><td>Deductible</td><td /><td className="num">−{money(calc.deductible)}</td><td /></tr>
                    <tr><td>Remaining annual limit</td><td /><td className="num">{money(calc.remaining_limit)}</td><td /></tr>
                    <tr><td><strong>Payable</strong></td><td /><td className="num"><strong>{money(calc.payable)}</strong></td><td /></tr>
                  </tbody>
                </table>
              </div>
              {calc.flags.map((f, i) => <span key={i} className="small value-conflict">! {f}</span>)}
            </div>
          </details>
        )}
        <label className="field">Note to the claimant (required to reject)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please confirm your admission date" /></label>
        <details>
          <summary className="small">Pay a different amount</summary>
          <label className="field" style={{ marginTop: 8 }}>Amount (₹), the reason goes in the note<input type="number" min="0" step="0.01" value={override} onChange={(e) => setOverride(e.target.value)} /></label>
        </details>
        {!ready && <p className="small muted">Block 1 lists something to check. You can still decide, or ask the claimant first (write it in the note and reject, so they can file again).</p>}
        <div className="row">
          <button className="primary" disabled={busy || !calc} onClick={() => run(() => api.post(`/api/v1/admin/claims/${claim.id}/approve`, { note: note || null, override_amount: override === '' ? null : Number(override) }), 'Approved. It is now in "To pay".')}>
            Approve {calc && money(override === '' ? calc.payable : Number(override))}
          </button>
          <button className="danger" disabled={busy || !note.trim()} onClick={() => run(() => api.post(`/api/v1/admin/claims/${claim.id}/reject`, { note }), 'Rejected.')}>Reject</button>
        </div>
      </>
    )

  return (
    <section className="block">
      <div className="block-head"><span className="block-num">3</span><h2>Decision</h2></div>
      <div className="block-body">
        {body}
        <Notice kind="error">{error}</Notice>
      </div>
    </section>
  )
}

export default function ClaimPage({ id }: { id: number }) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [owner, setOwner] = useState<User | null>(null)
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null | undefined>(undefined)
  const [calc, setCalc] = useState<Calculation | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rerunning, setRerunning] = useState(false)

  const load = useCallback(async () => {
    try {
      const c = await api.get<Claim>(`/api/v1/admin/claims/${id}`)
      setClaim(c)
      api.get<User[]>('/api/v1/admin/users').then((us) => setOwner(us.find((u) => u.id === c.user_id) ?? null)).catch(() => {})
      api.get<Calculation>(`/api/v1/admin/claims/${id}/calculation`).then(setCalc).catch(() => setCalc(null))
      setAnalysis(await api.get<ClaimAnalysis>(`/api/v1/admin/claims/${id}/analysis`).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }))
    } catch (err) {
      setError((err as Error).message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function rerun() {
    setRerunning(true)
    setError('')
    try {
      setAnalysis(await api.post<ClaimAnalysis>(`/api/v1/admin/claims/${id}/analyze`))
      setCalc(await api.get<Calculation>(`/api/v1/admin/claims/${id}/calculation`))
      setMessage('Checked again.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRerunning(false)
    }
  }

  if (!claim) return <div className="page narrow">{error ? <Notice kind="error">{error}</Notice> : <div className="empty"><Spinner /></div>}</div>
  const back = claim.status === 'approved' ? 'pay' : claim.status === 'submitted' ? 'review' : 'history'

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <button className="link back" onClick={() => navigate(`/claims/${back}`)}>← Claims</button>
          <div className="title-row" style={{ marginTop: 6 }}>
            <h1>{owner?.full_name ?? 'Claim'} · #{claim.id}</h1>
            <ClaimStatusBadge status={claim.status} />
          </div>
          <p className="sub">{claim.hospital_name ?? 'Hospital not given'} · {date(claim.treatment_start)} – {date(claim.treatment_end)} · claimed {money(claim.claimed_amount)}</p>
        </div>
        {claim.status !== 'draft' && <button className="small" disabled={rerunning} onClick={rerun}>{rerunning ? 'Checking…' : 'Check documents again'}</button>}
      </div>
      <Notice kind="success">{message}</Notice>
      <Notice kind="error">{error}</Notice>

      {rerunning || analysis === undefined ? (
        <section className="block"><div className="block-body"><div className="row"><Spinner /> {rerunning ? 'The AI is reading the documents again…' : 'Loading…'}</div></div></section>
      ) : analysis === null ? (
        <section className="block"><div className="block-body"><p className="muted">Not checked yet. Press “Check documents again”.</p><DocumentChips claim={claim} /></div></section>
      ) : (
        <ClaimSummary analysis={analysis}><DocumentChips claim={claim} /></ClaimSummary>
      )}

      <Decision claim={claim} calc={calc} ready={analysis?.recommendations.triage_category.value === 'ready_for_review'} onChanged={(m) => { setMessage(m); load() }} />
    </div>
  )
}
