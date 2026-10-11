import { useState, type ReactNode } from 'react'
import { formatValue, humanize, label, money, shortSource } from '../format'
import type { ClaimAnalysis, Fact, FieldSummary, LineItem, Provenance } from '../types'
import { ArrowLeftRight, CheckCircle2, ChevronRight, CircleHelp, FileText, Info, Lightbulb, PenLine, Sparkles, TriangleAlert } from 'lucide-react'
import { Icon, StatusBadge, TriageChip } from './ui'

const DETAIL_FIELDS = ['patient_name', 'hospital_name', 'invoice_number', 'admission_date', 'discharge_date', 'total_amount']

/** Small tag saying where a value came from. Purple = produced by the system, never by the claimant. */
export function SourceTag({ provenance, source }: { provenance: Provenance; source?: string }) {
  if (provenance === 'system_inferred') return <span className="tag system" title="Produced by the system, not stated by the claimant"><Icon icon={Sparkles} size={11} />System</span>
  if (provenance === 'claimant_form') return <span className="tag form" title="Typed by the claimant on the claim form"><Icon icon={PenLine} size={11} />Claim form</span>
  return <span className="tag doc" title={source ? `Read from: ${source}` : 'Read from a claimant document'}><Icon icon={FileText} size={11} />{source ? shortSource(source) : 'Document'}</span>
}

function Attention({ analysis }: { analysis: ClaimAnalysis }) {
  const triage = analysis.recommendations.triage_category
  const warnings = analysis.validation_flags.filter((f) => f.severity === 'warning')
  const nothingWrong = triage.value === 'ready_for_review'
  return (
    <section className="block">
      <div className="block-head">
        <span className="block-num">1</span>
        <h2>Needs attention</h2>
        <span className="spacer" />
        <TriageChip value={triage.value} />
      </div>
      <div className="block-body">
        {nothingWrong ? (
          <div className="all-good"><Icon icon={CheckCircle2} size={22} />All checks passed. Every required detail was provided and the documents agree.</div>
        ) : (
          <p>{triage.reason}</p>
        )}

        {analysis.conflicts.map((c) => {
          const counts = new Map<string, number>()
          c.values.forEach((v) => counts.set(JSON.stringify(v.value), (counts.get(JSON.stringify(v.value)) ?? 0) + 1))
          const max = Math.max(...counts.values())
          const clearMajority = [...counts.values()].filter((n) => n === max).length === 1
          return (
            <div key={c.field} className="issue conflict">
              <span className="issue-title"><Icon icon={ArrowLeftRight} />{label(c.field)} doesn't match</span>
              <div className="said">
                {c.values.map((v, i) => (
                  <span key={i} className={clearMajority && counts.get(JSON.stringify(v.value)) !== max ? 'odd' : ''} title={v.evidence ? `“${v.evidence}”` : 'Typed on the claim form'}>
                    {shortSource(v.source)}: <strong>{formatValue(c.field, v.value)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )
        })}

        {analysis.missing_fields.map((m) => (
          <div key={m.field} className="issue missing">
            <span className="issue-title"><Icon icon={CircleHelp} />Missing: {label(m.field)}</span>
            <span className="small">{m.reason}</span>
          </div>
        ))}

        {warnings.map((w, i) => (
          <div key={i} className="issue warning">
            <span className="issue-title"><Icon icon={TriangleAlert} />Check</span>
            <span className="small">{w.message}</span>
          </div>
        ))}

        {!nothingWrong && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row small"><Icon icon={Lightbulb} /><strong>Suggested next steps</strong><SourceTag provenance="system_inferred" /></div>
            <ol className="steps-list">
              {analysis.recommendations.next_steps.map((s, i) => <li key={i}>{s.action}</li>)}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

function FieldRow({ summary, facts, showSources }: { summary: FieldSummary; facts: Fact[]; showSources: boolean }) {
  let value: ReactNode
  if (summary.status === 'missing') value = <StatusBadge status="missing" />
  else if (summary.status === 'conflicting') value = <StatusBadge status="conflicting" />
  else value = <strong>{formatValue(summary.field, summary.value)}</strong>
  return (
    <>
      <div className="k">{label(summary.field)}</div>
      <div className="v">
        <div className="line">
          {value}
          {summary.status !== 'missing' && facts.map((f, i) => <SourceTag key={i} provenance={f.provenance} source={f.source} />)}
        </div>
        {showSources && facts.map((f, i) => (
          <div key={i} className="source-quote">
            <span>{shortSource(f.source)} says {formatValue(summary.field, f.value)}:</span>
            {f.evidence ? <q>{f.evidence.trim()}</q> : <em>typed on the form (no quote)</em>}
          </div>
        ))}
      </div>
    </>
  )
}

function Charges({ summary }: { summary: FieldSummary | undefined }) {
  if (!summary || summary.status !== 'provided' || !Array.isArray(summary.value)) return null
  const items = summary.value as LineItem[]
  const total = items.reduce((sum, i) => sum + i.amount, 0)
  return (
    <details>
      <summary>
        <Icon icon={ChevronRight} className="chevron" />{items.length} charges · {money(total)} <span className="muted small">(from {summary.sources.map(shortSource).join(', ')})</span>
      </summary>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <thead><tr><th>Charge</th><th>Category</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td><span className="row" style={{ gap: 6 }}>{item.category}<SourceTag provenance={item.category_provenance} /></span></td>
                <td className="num">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function TechnicalDetails({ analysis }: { analysis: ClaimAnalysis }) {
  const discarded = analysis.extractions.reduce((n, e) => n + e.guard_events.length, 0)
  return (
    <details className="small">
      <summary className="muted"><Icon icon={ChevronRight} className="chevron" />Technical details: AI model, prompt, discarded values ({discarded})</summary>
      <div className="stack" style={{ gap: 8, marginTop: 8 }}>
        <span className="muted">Model {analysis.model} · prompt {analysis.prompt_version}. Every value the AI returns must come with an exact quote from the document; values the document doesn't support are discarded.</span>
        {analysis.extractions.map((e, i) => (
          <div key={i}>
            <strong>{shortSource(e.source)}</strong>{' '}
            <span className="muted">uploaded as {humanize(e.source_type)}{e.detected_type ? `, reads like ${humanize(e.detected_type)}` : ''}</span>
            {e.error && <div className="notice error small">{e.error}</div>}
            {e.guard_events.map((g, j) => (
              <div key={j} className="muted">Discarded {label(g.field.split('[')[0])} = <code>{g.value}</code> ({humanize(g.reason)})</div>
            ))}
          </div>
        ))}
        {analysis.validation_flags.filter((f) => f.severity === 'info').map((f, i) => <div key={i} className="muted row" style={{ gap: 6, alignItems: 'flex-start' }}><Icon icon={Info} size={14} />{f.message}</div>)}
      </div>
    </details>
  )
}

/** Block 1 (what needs attention) and block 2 (the claim's details with sources). `children` go at the end of block 2. */
export default function ClaimSummary({ analysis, children }: { analysis: ClaimAnalysis; children?: ReactNode }) {
  const [showSources, setShowSources] = useState(false)
  return (
    <>
      <Attention analysis={analysis} />
      <section className="block">
        <div className="block-head">
          <span className="block-num">2</span>
          <h2>Claim details</h2>
          <span className="spacer" />
          <button className="small" onClick={() => setShowSources(!showSources)} aria-pressed={showSources}>
            {showSources ? 'Hide sources' : 'Show sources & quotes'}
          </button>
        </div>
        <div className="block-body">
          <div className="details">
            {DETAIL_FIELDS.map((field) =>
              analysis.fields[field] ? (
                <FieldRow key={field} summary={analysis.fields[field]} facts={analysis.facts.filter((f) => f.field === field)} showSources={showSources} />
              ) : null,
            )}
          </div>
          <Charges summary={analysis.fields.line_items} />
          {children}
          <TechnicalDetails analysis={analysis} />
        </div>
      </section>
    </>
  )
}
