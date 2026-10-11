import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { api, openDocument } from '../../api'
import { Notice, Spinner } from '../../components/ui'
import { date, humanize, money } from '../../format'
import { navigate } from '../../router'
import type { Claim, ClaimDocument, Policy } from '../../types'
import Progress from './Progress'

const MAX_MB = 10
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const SLOTS = [
  { type: 'hospital_bill', title: 'Hospital bill', hint: 'The final bill or money receipt with the total amount', required: true },
  { type: 'discharge_summary', title: 'Discharge summary', hint: 'The letter from the doctor when you left the hospital', required: true },
] as const

function Slot({ title, hint, required, docs, onFile, onRemove, uploading }: {
  title: string; hint: string; required: boolean; docs: ClaimDocument[]
  onFile: (file: File) => void; onRemove: (id: number) => void; uploading: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const unreadable = docs.some((d) => d.extraction_method === 'failed')
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0])
  }
  return (
    <div
      className={`slot${docs.length ? (unreadable ? ' problem' : ' filled') : ''}${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <span className="slot-icon" aria-hidden>{docs.length ? (unreadable ? '⚠️' : '✅') : '📄'}</span>
      <div className="slot-text">
        <strong>{title}{required ? ' *' : ' (optional)'}</strong>
        {docs.length === 0 && <span className="muted small">{hint}. Drop a PDF or photo here.</span>}
        {docs.map((d) => (
          <span key={d.id} className="small">
            {d.original_filename}{' '}
            {d.extraction_method === 'failed' ? <span className="value-conflict">couldn't read it. Try a clearer photo or the PDF.</span> : <span className="muted">· read ✓</span>}{' '}
            <button type="button" className="link small" onClick={() => onRemove(d.id)}>remove</button>
          </span>
        ))}
      </div>
      {uploading ? <Spinner /> : (
        <label className="file-button">
          {docs.length ? 'Add another' : 'Choose file'}
          <input type="file" accept={ACCEPT} onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = '' }} />
        </label>
      )}
    </div>
  )
}

function ClaimView({ claim }: { claim: Claim }) {
  const [error, setError] = useState('')
  return (
    <div className="page narrow">
      <div><button className="link back" onClick={() => navigate('/my-claims')}>← My claims</button></div>
      <section className="block">
        <div className="block-head"><h1 style={{ fontSize: '1.25rem' }}>{claim.hospital_name ?? 'Hospital stay'}</h1><span className="muted">#{claim.id}</span></div>
        <div className="block-body">
          <Progress claim={claim} />
          {claim.status === 'submitted' && <Notice kind="info">We're checking your documents. You'll see the result here.</Notice>}
          {claim.status === 'approved' && <Notice kind="success">Approved: {money(claim.approved_amount)}. The payment is on its way.</Notice>}
          {claim.status === 'paid' && <Notice kind="success">Paid: {money(claim.payment?.amount)} by {claim.payment?.method?.toUpperCase()} on {date(claim.payment?.paid_at)}.</Notice>}
          {claim.status === 'rejected' && <Notice kind="error">Not approved. {claim.admin_note}</Notice>}
          <div className="details">
            <div className="k">Stay</div><div className="v">{date(claim.treatment_start)} – {date(claim.treatment_end)}</div>
            <div className="k">Amount claimed</div><div className="v">{money(claim.claimed_amount)}</div>
            <div className="k">Bill number</div><div className="v">{claim.invoice_number ?? '-'}</div>
            <div className="k">Documents</div>
            <div className="v">
              {claim.documents.map((d) => (
                <span key={d.id} className="small">📄 {humanize(d.doc_type)}: <button className="link small" onClick={() => openDocument(`/api/v1/claims/${claim.id}/documents/${d.id}/file`).catch((e) => setError(e.message))}>{d.original_filename}</button></span>
              ))}
            </div>
          </div>
          <Notice kind="error">{error}</Notice>
        </div>
      </section>
    </div>
  )
}

export default function ClaimWizard({ id }: { id: number | null }) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [step, setStep] = useState(1)
  const [f, setF] = useState({ policy_id: '', hospital_name: '', treatment_start: '', treatment_end: '', claimed_amount: '', invoice_number: '', description: '' })
  const [uploading, setUploading] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(id !== null)

  const fill = (c: Claim) => {
    setClaim(c)
    setF({
      policy_id: String(c.policy_id), hospital_name: c.hospital_name ?? '', treatment_start: c.treatment_start ?? '', treatment_end: c.treatment_end ?? '',
      claimed_amount: c.claimed_amount ? String(c.claimed_amount) : '', invoice_number: c.invoice_number ?? '', description: c.description ?? '',
    })
  }
  const reload = useCallback(async () => {
    if (id === null) return
    const c = await api.get<Claim>(`/api/v1/claims/${id}`)
    fill(c)
    return c
  }, [id])

  useEffect(() => {
    api.get<Policy[]>('/api/v1/policies').then((p) => { setPolicies(p); setF((v) => ({ ...v, policy_id: v.policy_id || String(p[0]?.id ?? '') })) }).catch((e) => setError(e.message))
    reload().then((c) => { if (c?.documents.length) setStep(2) }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [reload])

  if (loading) return <div className="page narrow"><div className="empty"><Spinner /></div></div>
  if (claim && claim.status !== 'draft') return <ClaimView claim={claim} />

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      hospital_name: f.hospital_name.trim(), treatment_start: f.treatment_start, treatment_end: f.treatment_end,
      claimed_amount: Number(f.claimed_amount), invoice_number: f.invoice_number.trim() || null, description: f.description.trim() || null,
    }
    try {
      if (claim) fill(await api.patch<Claim>(`/api/v1/claims/${claim.id}`, body))
      else {
        const created = await api.post<Claim>('/api/v1/claims', { ...body, policy_id: Number(f.policy_id) })
        fill(created)
        window.history.replaceState(null, '', `#/claim/${created.id}`)
      }
      setStep(2)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function upload(docType: string, file: File) {
    if (!claim) return
    setError('')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is bigger than ${MAX_MB} MB.`)
    if (!ACCEPT.split(',').includes(file.type)) return setError('Please upload a PDF or a photo (JPEG, PNG or WEBP).')
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)
    setUploading(docType)
    try {
      await api.upload(`/api/v1/claims/${claim.id}/documents`, form)
      fill(await api.get<Claim>(`/api/v1/claims/${claim.id}`))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading('')
    }
  }

  async function remove(docId: number) {
    if (!claim) return
    try {
      await api.del(`/api/v1/claims/${claim.id}/documents/${docId}`)
      fill(await api.get<Claim>(`/api/v1/claims/${claim.id}`))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function submit() {
    if (!claim) return
    setBusy(true)
    setError('')
    try {
      fill(await api.post<Claim>(`/api/v1/claims/${claim.id}/submit`))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const docsOf = (type: string) => (claim?.documents ?? []).filter((d) => d.doc_type === type)
  const others = (claim?.documents ?? []).filter((d) => !SLOTS.some((s) => s.type === d.doc_type))
  const requiredDone = SLOTS.every((s) => docsOf(s.type).length > 0)
  const steps = ['Your stay', 'Documents', 'Review & submit']

  return (
    <div className="page narrow">
      <div><button className="link back" onClick={() => navigate('/my-claims')}>← My claims</button></div>
      <h1>{claim ? 'Finish your claim' : 'New claim'}</h1>
      <div className="wizard-steps">
        {steps.map((s, i) => (
          <span key={s} className={`ws${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`}>{step > i + 1 ? '✓' : i + 1} {s}</span>
        ))}
      </div>
      <Notice kind="error">{error}</Notice>

      {step === 1 && (
        <form className="block" onSubmit={saveDetails}>
          <div className="block-body">
            {policies.length > 1 && (
              <label className="field">Policy<select value={f.policy_id} disabled={!!claim} onChange={(e) => setF({ ...f, policy_id: e.target.value })}>{policies.map((p) => <option key={p.id} value={p.id}>{p.policy_number}</option>)}</select></label>
            )}
            <label className="field">Hospital name<input value={f.hospital_name} required onChange={(e) => setF({ ...f, hospital_name: e.target.value })} placeholder="e.g. Sahyadri Care Hospital, Pune" /></label>
            <div className="grid-2">
              <label className="field">Admitted on<input type="date" value={f.treatment_start} required onChange={(e) => setF({ ...f, treatment_start: e.target.value })} /></label>
              <label className="field">Discharged on<input type="date" value={f.treatment_end} required min={f.treatment_start || undefined} onChange={(e) => setF({ ...f, treatment_end: e.target.value })} /></label>
            </div>
            <label className="field">Total amount on the bill (₹)<input className="big-total" type="number" min="1" step="0.01" value={f.claimed_amount} required onChange={(e) => setF({ ...f, claimed_amount: e.target.value })} placeholder="16450" /></label>
            <details>
              <summary className="small">More details (optional)</summary>
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                <label className="field">Bill / invoice number<input value={f.invoice_number} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} /></label>
                <label className="field">What happened?<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Admitted with dengue fever" /></label>
              </div>
            </details>
            <div className="row"><span className="spacer" /><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Next: documents'}</button></div>
          </div>
        </form>
      )}

      {step === 2 && claim && (
        <section className="block">
          <div className="block-body">
            <p className="muted small">Upload a PDF or a clear photo of each document (max {MAX_MB} MB). We read the text automatically.</p>
            {SLOTS.map((s) => (
              <Slot key={s.type} title={s.title} hint={s.hint} required={s.required} docs={docsOf(s.type)} uploading={uploading === s.type} onFile={(file) => upload(s.type, file)} onRemove={remove} />
            ))}
            <Slot title="Other documents" hint="Prescriptions, lab reports" required={false} docs={others} uploading={uploading === 'other'} onFile={(file) => upload('other', file)} onRemove={remove} />
            <div className="row">
              <button type="button" onClick={() => setStep(1)}>Back</button>
              <span className="spacer" />
              <button className="primary" disabled={!requiredDone || !!uploading} onClick={() => setStep(3)}>Next: review</button>
            </div>
            {!requiredDone && <span className="muted small">The hospital bill and the discharge summary are both needed.</span>}
          </div>
        </section>
      )}

      {step === 3 && claim && (
        <section className="block">
          <div className="block-body">
            <div className="details">
              <div className="k">Hospital</div><div className="v">{claim.hospital_name}</div>
              <div className="k">Stay</div><div className="v">{date(claim.treatment_start)} – {date(claim.treatment_end)}</div>
              <div className="k">Amount</div><div className="v"><strong>{money(claim.claimed_amount)}</strong></div>
              <div className="k">Documents</div><div className="v">{claim.documents.map((d) => <span key={d.id} className="small">📄 {humanize(d.doc_type)}: {d.original_filename}</span>)}</div>
            </div>
            <p className="small muted">Please check the details. After you submit, your documents are checked and the claim is reviewed by our team.</p>
            <div className="row">
              <button type="button" onClick={() => setStep(2)}>Back</button>
              <span className="spacer" />
              <button className="primary" disabled={busy} onClick={submit}>{busy ? 'Submitting… (checking your documents)' : 'Submit claim'}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
