import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import AnalysisView from '../components/AnalysisView'
import { Card, Notice, Spinner, TriageChip } from '../components/ui'
import { humanize, label, SOURCE_TYPES } from '../format'
import type { AnalyzeRequest, ClaimAnalysis, ClaimForm, ExampleCase, PolicyInfo, SourceDocument, SourceType } from '../types'

const EMPTY_SOURCE: SourceDocument = { name: 'Hospital bill', type: 'hospital_bill', text: '' }

function clean<T extends object>(obj: T): T {
  // Blank inputs mean "not provided": send null, never an empty string.
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v])) as T
}

function Expected({ example, analysis }: { example: ExampleCase; analysis: ClaimAnalysis }) {
  const gotConflicts = analysis.conflicts.map((c) => c.field).sort()
  const gotMissing = analysis.missing_fields.map((m) => m.field).sort()
  const checks = [
    { name: 'Triage', ok: analysis.recommendations.triage_category.value === example.expected.triage_category, expected: humanize(example.expected.triage_category) },
    { name: 'Conflicts', ok: JSON.stringify(gotConflicts) === JSON.stringify([...example.expected.conflicts].sort()), expected: example.expected.conflicts.map(label).join(', ') || 'none' },
    { name: 'Missing', ok: JSON.stringify(gotMissing) === JSON.stringify([...example.expected.missing_fields].sort()), expected: example.expected.missing_fields.map(label).join(', ') || 'none' },
  ]
  const allOk = checks.every((c) => c.ok)
  return (
    <Notice kind={allOk ? 'success' : 'warn'}>
      <strong>{allOk ? '✓ Matches the expected result for ' : '! Differs from the expected result for '}{example.id}</strong>
      {checks.map((c) => (
        <div key={c.name} className="small">
          {c.ok ? '✓' : '✗'} {c.name}: expected {c.expected}
        </div>
      ))}
    </Notice>
  )
}

export default function Playground() {
  const [examples, setExamples] = useState<ExampleCase[]>([])
  const [exampleId, setExampleId] = useState('')
  const [form, setForm] = useState<ClaimForm>({})
  const [policy, setPolicy] = useState<PolicyInfo>({})
  const [sources, setSources] = useState<SourceDocument[]>([{ ...EMPTY_SOURCE }])
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ExampleCase[]>('/api/v1/analyze/examples').then(setExamples).catch(() => setExamples([]))
  }, [])

  const example = examples.find((e) => e.id === exampleId)

  function loadExample(id: string) {
    setExampleId(id)
    setAnalysis(null)
    setError('')
    const ex = examples.find((e) => e.id === id)
    if (!ex) return
    setForm(ex.request.form)
    setPolicy(ex.request.policy ?? {})
    setSources(ex.request.sources.map((s) => ({ ...s })))
  }

  function reset() {
    setExampleId('')
    setForm({})
    setPolicy({})
    setSources([{ ...EMPTY_SOURCE }])
    setAnalysis(null)
    setError('')
  }

  function updateSource(index: number, patch: Partial<SourceDocument>) {
    setSources(sources.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  async function analyze(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setAnalysis(null)
    const hasPolicy = Object.values(policy).some((v) => v)
    const body: AnalyzeRequest = {
      form: clean({ ...form, total_amount: form.total_amount === null || form.total_amount === undefined || Number.isNaN(form.total_amount) ? null : form.total_amount }),
      sources: sources.filter((s) => s.text.trim()),
      policy: hasPolicy ? clean(policy) : null,
    }
    try {
      setAnalysis(await api.post<ClaimAnalysis>('/api/v1/analyze', body))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const text = (key: keyof ClaimForm) => ({
    value: (form[key] as string | null | undefined) ?? '',
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
  })
  const policyText = (key: keyof PolicyInfo) => ({
    value: policy[key] ?? '',
    onChange: (e: { target: { value: string } }) => setPolicy({ ...policy, [key]: e.target.value }),
  })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Analyze a claim</h1>
          <p>Paste what the claimant typed and the text of each document. Every document is read by the AI, then checked by code.</p>
        </div>
      </div>

      <div className="split">
        <form className="stack" onSubmit={analyze}>
          <Card title="Input" actions={<button type="button" className="small" onClick={reset}>Clear</button>}>
            <label className="field">
              Load a test case ({examples.length} synthetic claims)
              <select value={exampleId} onChange={(e) => loadExample(e.target.value)}>
                <option value="">Choose an example…</option>
                {['clean', 'incomplete', 'contradictory', 'tricky'].map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {examples.filter((e) => e.category === cat).map((e) => (
                      <option key={e.id} value={e.id}>{e.id}: {e.description}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {example && <p className="small muted">{example.description}</p>}

            <fieldset>
              <legend>Claim form (typed by the claimant; leave blank if not given)</legend>
              <div className="grid-2">
                <label className="field">Patient name<input {...text('patient_name')} /></label>
                <label className="field">Policy number<input {...text('policy_number')} /></label>
                <label className="field">Hospital<input {...text('hospital_name')} /></label>
                <label className="field">Invoice number<input {...text('invoice_number')} /></label>
                <label className="field">Admission date<input type="date" {...text('admission_date')} /></label>
                <label className="field">Discharge date<input type="date" {...text('discharge_date')} /></label>
                <label className="field">
                  Total claimed (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_amount ?? ''}
                    onChange={(e) => setForm({ ...form, total_amount: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </label>
              </div>
            </fieldset>

            <details>
              <summary>Policy on record (insurer's data, optional)</summary>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <label className="field">Holder name<input {...policyText('holder_name')} /></label>
                <label className="field">Policy number<input {...policyText('policy_number')} /></label>
                <label className="field">Start date<input type="date" {...policyText('start_date')} /></label>
                <label className="field">End date<input type="date" {...policyText('end_date')} /></label>
              </div>
            </details>

            {sources.map((source, i) => (
              <fieldset key={i}>
                <legend>Document {i + 1}</legend>
                <div className="grid-2">
                  <label className="field">Name<input value={source.name} onChange={(e) => updateSource(i, { name: e.target.value })} required /></label>
                  <label className="field">
                    Type
                    <select value={source.type} onChange={(e) => updateSource(i, { type: e.target.value as SourceType })}>
                      {SOURCE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="field">
                  Text
                  <textarea value={source.text} onChange={(e) => updateSource(i, { text: e.target.value })} placeholder="Paste the document text here" rows={8} />
                </label>
                {sources.length > 1 && (
                  <button type="button" className="small danger" onClick={() => setSources(sources.filter((_, j) => j !== i))}>Remove document</button>
                )}
              </fieldset>
            ))}
            <div className="row">
              <button type="button" className="small" disabled={sources.length >= 10} onClick={() => setSources([...sources, { name: `Document ${sources.length + 1}`, type: 'other', text: '' }])}>
                + Add document
              </button>
              <span className="spacer" />
              <button className="primary" disabled={busy || !sources.some((s) => s.text.trim())}>
                {busy ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          </Card>
        </form>

        <div className="stack">
          <Notice kind="error">{error}</Notice>
          {busy && (
            <Card>
              <div className="row"><Spinner /> <span>The AI is reading {sources.filter((s) => s.text.trim()).length} document(s), one call each. This usually takes 5–60 seconds.</span></div>
            </Card>
          )}
          {!busy && !analysis && !error && (
            <Card>
              <div className="empty">
                <p><strong>No analysis yet.</strong></p>
                <p className="small">Load a test case or paste a claim, then press Analyze.</p>
                <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
                  <TriageChip value="ready_for_review" />
                  <TriageChip value="needs_more_information" />
                  <TriageChip value="conflicting_information" />
                  <TriageChip value="possible_issue" />
                </div>
              </div>
            </Card>
          )}
          {analysis && example && <Expected example={example} analysis={analysis} />}
          {analysis && <AnalysisView analysis={analysis} />}
        </div>
      </div>
    </div>
  )
}
