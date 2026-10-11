import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import Documents from '../components/Documents'
import { Card, ClaimStatusBadge, Notice, Spinner } from '../components/ui'
import { CATEGORIES, DOC_TYPES, humanize, money } from '../format'
import { navigate } from '../router'
import type { Claim, ClaimDocument, ClaimItem, Policy } from '../types'

const MAX_MB = 10
const NEW_ITEM: ClaimItem = { category: 'room', description: '', amount: 0, quantity: 1 }

export default function ClaimEditor({ id }: { id: number | null }) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [policies, setPolicies] = useState<Policy[] | null>(null)
  const [policyId, setPolicyId] = useState('')
  const [invoice, setInvoice] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ClaimItem[]>([{ ...NEW_ITEM }])
  const [docType, setDocType] = useState<string>('hospital_bill')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = (c: Claim) => {
    setClaim(c)
    setPolicyId(String(c.policy_id))
    setInvoice(c.invoice_number ?? '')
    setStart(c.treatment_start ?? '')
    setEnd(c.treatment_end ?? '')
    setDescription(c.description ?? '')
    setItems(c.items.length ? c.items.map((i) => ({ ...i })) : [{ ...NEW_ITEM }])
  }

  const load = useCallback(async () => {
    if (id !== null) apply(await api.get<Claim>(`/api/v1/claims/${id}`))
  }, [id])

  useEffect(() => {
    api.get<Policy[]>('/api/v1/policies').then((p) => { setPolicies(p); if (p.length) setPolicyId((v) => v || String(p[0].id)) }).catch((e) => setError(e.message))
    load().catch((e) => setError(e.message))
  }, [load])

  const editable = !claim || claim.status === 'draft'
  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

  async function save(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const body = {
      invoice_number: invoice || null,
      treatment_start: start || null,
      treatment_end: end || null,
      description: description || null,
      items: items.filter((i) => i.description.trim() && i.amount > 0).map((i) => ({ ...i, amount: Number(i.amount), quantity: Number(i.quantity) || 1 })),
    }
    try {
      if (claim) {
        apply(await api.patch<Claim>(`/api/v1/claims/${claim.id}`, body))
        setMessage('Saved.')
      } else {
        const created = await api.post<Claim>('/api/v1/claims', { ...body, policy_id: Number(policyId) })
        navigate(`/my-claims/${created.id}`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File | undefined) {
    if (!file || !claim) return
    setError('')
    setMessage('')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_MB} MB.`)
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)
    setUploading(true)
    try {
      const doc = await api.upload<ClaimDocument>(`/api/v1/claims/${claim.id}/documents`, form)
      setMessage(doc.extraction_method === 'failed' ? `Uploaded, but the text could not be read: ${doc.extraction_error}` : `Uploaded “${doc.original_filename}” and read its text.`)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function removeDoc(docId: number) {
    if (!claim) return
    try {
      await api.del(`/api/v1/claims/${claim.id}/documents/${docId}`)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function submit() {
    if (!claim) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await save()
      apply(await api.post<Claim>(`/api/v1/claims/${claim.id}/submit`))
      setMessage('Submitted. Our team will review your claim.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (policies === null && !error) return <div className="page"><div className="empty"><Spinner /></div></div>
  if (policies && policies.length === 0 && !claim)
    return <div className="page"><Notice kind="info">You don't have a policy yet. Please ask the insurer to add your policy, then come back to file a claim.</Notice></div>

  const updateItem = (i: number, patch: Partial<ClaimItem>) => setItems(items.map((item, j) => (j === i ? { ...item, ...patch } : item)))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="link" onClick={() => navigate('/my-claims')}>← My claims</button>
          <h1 style={{ marginTop: 6 }}>{claim ? <>Claim #{claim.id} <ClaimStatusBadge status={claim.status} /></> : 'New claim'}</h1>
          {claim?.status === 'approved' && <p>Approved amount {money(claim.approved_amount)}. Payment is on its way.</p>}
          {claim?.status === 'paid' && <p>Paid {money(claim.payment?.amount)} ({claim.payment?.method?.toUpperCase()} {claim.payment?.reference}).</p>}
          {claim?.status === 'rejected' && <p>Rejected: {claim.admin_note}</p>}
        </div>
      </div>
      <Notice kind="error">{error}</Notice>
      <Notice kind="success">{message}</Notice>

      <div className="split">
        <form onSubmit={save}>
          <Card title="Claim details">
            <fieldset disabled={!editable} style={{ border: 'none', padding: 0 }}>
              <div className="stack" style={{ gap: 10 }}>
                <label className="field">
                  Policy
                  <select value={policyId} onChange={(e) => setPolicyId(e.target.value)} disabled={!!claim}>
                    {(policies ?? []).map((p) => <option key={p.id} value={p.id}>{p.policy_number} ({p.holder_name})</option>)}
                  </select>
                </label>
                <label className="field">Invoice / bill number<input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></label>
                <div className="grid-2">
                  <label className="field">Admitted on<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                  <label className="field">Discharged on<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
                </div>
                <label className="field">What happened?<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ fontFamily: 'inherit', minHeight: 70 }} /></label>
                <strong className="small">Expenses</strong>
                {items.map((item, i) => (
                  <div key={i} className="grid-3" style={{ gridTemplateColumns: '1.2fr 2fr 1fr 0.6fr auto', alignItems: 'end' }}>
                    <label className="field">Category<select value={item.category} onChange={(e) => updateItem(i, { category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                    <label className="field">Description<input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} /></label>
                    <label className="field">Amount ₹<input type="number" min="0" step="0.01" value={item.amount || ''} onChange={(e) => updateItem(i, { amount: Number(e.target.value) })} /></label>
                    <label className="field" title="Days or visits">Qty<input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} /></label>
                    <button type="button" className="small" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ ...NEW_ITEM }])} aria-label="Remove expense">✕</button>
                  </div>
                ))}
                <div className="row">
                  <button type="button" className="small" onClick={() => setItems([...items, { ...NEW_ITEM }])}>+ Add expense</button>
                  <span className="spacer" />
                  <span>Total <strong>{money(total)}</strong></span>
                </div>
                {editable && <button className="primary" disabled={busy}>{claim ? 'Save' : 'Create claim'}</button>}
              </div>
            </fieldset>
          </Card>
        </form>

        <div className="stack">
          <Card title="Documents" hint="Hospital bill and discharge summary are required">
            {!claim ? (
              <p className="muted small">Create the claim first, then upload documents.</p>
            ) : (
              <>
                {editable && (
                  <div className="row">
                    <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ width: 'auto' }} aria-label="Document type">
                      {DOC_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                    </select>
                    <label className="field" style={{ flex: 1 }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                    {uploading && <><span className="spinner" /> <span className="small muted">Uploading and reading text…</span></>}
                  </div>
                )}
                <p className="muted small">JPEG, PNG, WEBP or PDF, up to {MAX_MB} MB. Text is read automatically (PDF text or OCR for photos and scans).</p>
                <Documents claimId={claim.id} documents={claim.documents} onDelete={editable ? removeDoc : undefined} />
              </>
            )}
          </Card>
          {claim && editable && (
            <Card title="Submit">
              <p className="small muted">After submitting you can't change the claim. Your documents will be checked and the claim reviewed.</p>
              <button className="primary" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit claim'}</button>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
