import { useEffect, useState } from 'react'
import { api } from '../../api'
import ClaimSummary from '../../components/ClaimSummary'
import { Check, ChevronRight, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Icon, Notice, Skeleton, Spinner } from '../../components/ui'
import { humanize, label, SOURCE_TYPES } from '../../format'
import type { AnalyzeRequest, ClaimAnalysis, ExampleCase, SourceType } from '../../types'

const BLANK: AnalyzeRequest = { form: {}, sources: [{ name: 'Hospital bill', type: 'hospital_bill', text: '' }], policy: null }

function Verdict({ example, analysis }: { example: ExampleCase; analysis: ClaimAnalysis }) {
  const sameSet = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
  const checks = [
    ['Triage', analysis.recommendations.triage_category.value === example.expected.triage_category, humanize(example.expected.triage_category)],
    ['Conflicts', sameSet(analysis.conflicts.map((c) => c.field), example.expected.conflicts), example.expected.conflicts.map(label).join(', ') || 'none'],
    ['Missing', sameSet(analysis.missing_fields.map((m) => m.field), example.expected.missing_fields), example.expected.missing_fields.map(label).join(', ') || 'none'],
  ] as const
  const ok = checks.every(([, pass]) => pass)
  return (
    <Notice kind={ok ? 'success' : 'warn'}>
      <strong>{ok ? 'Matches the expected result' : 'Differs from the expected result'}</strong>
      {checks.map(([name, pass, expected]) => <div key={name} className="small row" style={{ gap: 6 }}><Icon icon={pass ? Check : X} size={14} />{name}: expected {expected}</div>)}
    </Notice>
  )
}

export default function TestCases() {
  const [examples, setExamples] = useState<ExampleCase[]>([])
  const [selected, setSelected] = useState('')
  const [input, setInput] = useState<AnalyzeRequest>(BLANK)
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ExampleCase[]>('/api/v1/analyze/examples').then(setExamples).catch((e) => setError(e.message))
  }, [])

  const example = examples.find((e) => e.id === selected)

  function choose(id: string) {
    setSelected(id)
    setAnalysis(null)
    setError('')
    const ex = examples.find((e) => e.id === id)
    setInput(ex ? structuredClone(ex.request) : BLANK)
  }

  async function run() {
    setBusy(true)
    setError('')
    setAnalysis(null)
    try {
      setAnalysis(await api.post<ClaimAnalysis>('/api/v1/analyze', { ...input, sources: input.sources.filter((s) => s.text.trim()) }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const setSource = (i: number, patch: object) => setInput({ ...input, sources: input.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const setFormField = (key: string, value: string) => setInput({ ...input, form: { ...input.form, [key]: value === '' ? null : key === 'total_amount' ? Number(value) : value } })

  return (
    <div className="page narrow">
      <div className="page-head"><div><h1>Test cases</h1><p>Run the AI check on one of the 24 synthetic claims (or your own text) without saving anything.</p></div></div>

      <section className="block">
        <div className="block-body">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1, minWidth: 0 }}>
              Test case
              <select value={selected} onChange={(e) => choose(e.target.value)}>
                <option value="">Your own text…</option>
                {['clean', 'incomplete', 'contradictory', 'tricky'].map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {examples.filter((e) => e.category === cat).map((e) => <option key={e.id} value={e.id}>{e.id}: {e.description}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <button className="primary" disabled={busy || !input.sources.some((s) => s.text.trim())} onClick={run}>{busy ? <><Spinner label="Checking" />Checking…</> : <><Icon icon={Sparkles} />Run AI check</>}</button>
          </div>
          {example && <p className="muted small">{example.description}</p>}
          <details open={!selected}>
            <summary className="small"><Icon icon={ChevronRight} className="chevron" />Input: claim form and {input.sources.length} document(s)</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              <div className="grid-3">
                {(['patient_name', 'hospital_name', 'invoice_number', 'admission_date', 'discharge_date', 'total_amount'] as const).map((key) => (
                  <label key={key} className="field">
                    {label(key)} (form)
                    <input type={key.endsWith('date') ? 'date' : key === 'total_amount' ? 'number' : 'text'} value={(input.form[key] as string | number | null | undefined) ?? ''} onChange={(e) => setFormField(key, e.target.value)} />
                  </label>
                ))}
              </div>
              {input.sources.map((s, i) => (
                <div key={i} className="stack" style={{ gap: 6 }}>
                  <div className="row">
                    <input value={s.name} onChange={(e) => setSource(i, { name: e.target.value })} style={{ maxWidth: 220 }} aria-label="Document name" />
                    <select value={s.type} onChange={(e) => setSource(i, { type: e.target.value as SourceType })} style={{ maxWidth: 200 }} aria-label="Document type">
                      {SOURCE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                    </select>
                    {input.sources.length > 1 && <button className="small danger" onClick={() => setInput({ ...input, sources: input.sources.filter((_, j) => j !== i) })}><Icon icon={Trash2} size={14} />Remove</button>}
                  </div>
                  <textarea value={s.text} rows={6} onChange={(e) => setSource(i, { text: e.target.value })} placeholder="Paste the document text" aria-label={`Text of ${s.name}`} />
                </div>
              ))}
              <div><button className="small" disabled={input.sources.length >= 10} onClick={() => setInput({ ...input, sources: [...input.sources, { name: `Document ${input.sources.length + 1}`, type: 'other', text: '' }] })}><Icon icon={Plus} size={14} />Add document</button></div>
            </div>
          </details>
        </div>
      </section>

      <Notice kind="error">{error}</Notice>
      {busy && <section className="block"><div className="block-body"><div className="row"><Spinner /> The AI is reading each document (5–60 seconds)…</div><Skeleton lines={4} /></div></section>}
      {analysis && example && <Verdict example={example} analysis={analysis} />}
      {analysis && <ClaimSummary analysis={analysis} />}
    </div>
  )
}
