import { Fragment, useState } from 'react'
import { dateTime, formatValue, humanize, label, money } from '../format'
import type { ClaimAnalysis, Conflict, ExtractionResult, Fact, FieldSummary, LineItem } from '../types'
import { Card, ProvenanceBadge, Quote, StatusBadge, TriageChip } from './ui'

const FIELD_ORDER = ['patient_name', 'hospital_name', 'invoice_number', 'admission_date', 'discharge_date', 'total_amount']

function sourceLabel(source: string): string {
  if (source === 'claim_form') return 'Claim form'
  if (source === 'system') return 'System (computed)'
  return source
}

function FieldValue({ summary }: { summary: FieldSummary }) {
  if (summary.status === 'missing') return <span className="value-missing">Not provided by any source</span>
  if (summary.status === 'conflicting') return <span className="value-conflict">Sources disagree, see Conflicts</span>
  return <strong>{formatValue(summary.field, summary.value)}</strong>
}

function FieldsTable({ analysis }: { analysis: ClaimAnalysis }) {
  const [open, setOpen] = useState<string | null>(null)
  const factsFor = (field: string): Fact[] => analysis.facts.filter((f) => f.field === field)
  return (
    <Card title="Claim fields" hint="Click a row to see every source's value and the exact quote it came from" flush>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Status</th>
              <th>Value</th>
              <th>Where it came from</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_ORDER.map((field) => {
              const summary = analysis.fields[field]
              if (!summary) return null
              const facts = factsFor(field)
              const isOpen = open === field
              return (
                <Fragment key={field}>
                  <tr
                    className="clickable"
                    onClick={() => setOpen(isOpen ? null : field)}
                    aria-expanded={isOpen}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : field))}
                  >
                    <td><strong>{label(field)}</strong></td>
                    <td><StatusBadge status={summary.status} /></td>
                    <td><FieldValue summary={summary} /></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {facts.length === 0 && <span className="muted small">-</span>}
                        {facts.map((f, i) => (
                          <ProvenanceBadge key={i} provenance={f.provenance} source={f.provenance === 'claimant_document' ? f.source : undefined} />
                        ))}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="expanded-row">
                      <td colSpan={4}>
                        {facts.length === 0 ? (
                          <p className="muted small">No source provided this field. The system does not guess it.</p>
                        ) : (
                          <div className="stack" style={{ gap: 10 }}>
                            {facts.map((f, i) => (
                              <div key={i} className="stack" style={{ gap: 4 }}>
                                <div className="row small">
                                  <strong>{sourceLabel(f.source)}</strong>
                                  <span>says</span>
                                  <strong>{formatValue(field, f.value)}</strong>
                                </div>
                                <Quote text={f.evidence} />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ConflictCard({ conflict }: { conflict: Conflict }) {
  // Highlight values that differ from the most common one. Nothing is chosen as "right".
  const counts = new Map<string, number>()
  conflict.values.forEach((v) => counts.set(JSON.stringify(v.value), (counts.get(JSON.stringify(v.value)) ?? 0) + 1))
  const max = Math.max(...counts.values())
  const unanimousMajority = [...counts.values()].filter((c) => c === max).length === 1
  return (
    <div className="conflict-card">
      <div className="head">
        <span aria-hidden>⇄</span>
        {label(conflict.field)}
        <span className="spacer" />
        <span className="badge bad">{conflict.severity} severity</span>
      </div>
      <div className="conflict-cols">
        {conflict.values.map((v, i) => {
          const odd = unanimousMajority && counts.get(JSON.stringify(v.value)) !== max
          return (
            <div key={i} className={`conflict-col${odd ? ' odd' : ''}`}>
              <div className="small muted">{sourceLabel(v.source)}</div>
              <div className="val">{formatValue(conflict.field, v.value)}</div>
              <ProvenanceBadge provenance={v.provenance} />
              <Quote text={v.evidence} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineItems({ analysis }: { analysis: ClaimAnalysis }) {
  const summary = analysis.fields.line_items
  if (!summary || summary.status !== 'provided' || !Array.isArray(summary.value)) return null
  const items = summary.value as LineItem[]
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return (
    <Card title="Itemised charges" hint={`From: ${summary.sources.map(sourceLabel).join(', ')}`} flush>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>
                  {item.description}
                  {item.evidence && <div className="muted small mono">“{item.evidence.trim()}”</div>}
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <span>{item.category}</span>
                    <ProvenanceBadge provenance={item.category_provenance} />
                  </div>
                </td>
                <td className="num">{money(item.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="muted small">Sum of items (computed by the system, for comparison with the stated total)</td>
              <td className="num"><strong>{money(total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ExtractionDetails({ extraction }: { extraction: ExtractionResult }) {
  const found = Object.entries(extraction.fields).filter(([, f]) => f.value !== null)
  return (
    <details>
      <summary>
        {extraction.source}{' '}
        {extraction.error && <span className="badge bad">could not be read</span>}
        {extraction.guard_events.length > 0 && <span className="badge warn">{extraction.guard_events.length} discarded</span>}
      </summary>
      <div className="stack" style={{ gap: 8, marginTop: 8 }}>
        <dl className="kv">
          <dt>Uploaded as</dt>
          <dd>{humanize(extraction.source_type)}</dd>
          <dt>AI reads it as</dt>
          <dd className="row" style={{ gap: 6 }}>
            {extraction.detected_type ? humanize(extraction.detected_type) : '-'} <ProvenanceBadge provenance="system_inferred" />
          </dd>
          <dt>Fields found</dt>
          <dd>{found.length ? found.map(([k]) => label(k)).join(', ') : 'none'}</dd>
          <dt>Line items</dt>
          <dd>{extraction.line_items.length}</dd>
        </dl>
        {extraction.error && <div className="notice error">{extraction.error}</div>}
        {extraction.guard_events.map((event, i) => (
          <div key={i} className="notice warn small">
            <strong>Discarded {label(event.field.split('[')[0])}</strong> = <code>{event.value ?? 'null'}</code>
            <br />
            Reason: {humanize(event.reason)}
            {event.evidence && (
              <>
                <br />
                Quote given: <code>“{event.evidence.trim()}”</code>
              </>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

export default function AnalysisView({ analysis }: { analysis: ClaimAnalysis }) {
  const triage = analysis.recommendations.triage_category
  const warnings = analysis.validation_flags.filter((f) => f.severity === 'warning')
  const infos = analysis.validation_flags.filter((f) => f.severity === 'info')
  const systemFacts = analysis.facts.filter((f) => f.provenance === 'system_inferred')

  return (
    <div className="stack">
      <section className="card">
        <div className="triage-banner">
          <div className="stack" style={{ gap: 6 }}>
            <span className="small muted">Recommended triage</span>
            <TriageChip value={triage.value} large />
          </div>
          <div className="reason stack" style={{ gap: 6 }}>
            <p>{triage.reason}</p>
            <div className="meta">
              <ProvenanceBadge provenance="system_inferred" />
              <span>Model {analysis.model}</span>
              <span>Prompt {analysis.prompt_version}</span>
              <span>{dateTime(analysis.analyzed_at)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="legend">
        <span>Legend:</span>
        <StatusBadge status="provided" />
        <StatusBadge status="missing" />
        <StatusBadge status="conflicting" />
        <StatusBadge status="multiple" />
        <ProvenanceBadge provenance="claimant_form" />
        <ProvenanceBadge provenance="claimant_document" />
        <ProvenanceBadge provenance="system_inferred" />
      </div>

      <div className="analysis-grid">
        <div className="stack">
          {analysis.conflicts.length > 0 && (
            <Card title={`Conflicts (${analysis.conflicts.length})`} hint="Every source's value is shown. The system does not pick one.">
              {analysis.conflicts.map((c) => <ConflictCard key={c.field} conflict={c} />)}
            </Card>
          )}
          {analysis.missing_fields.length > 0 && (
            <Card title={`Missing (${analysis.missing_fields.length})`} hint="Not provided by any source, so marked missing instead of guessed">
              {analysis.missing_fields.map((m) => (
                <div key={m.field} className="missing-item">
                  <strong>{label(m.field)}</strong>
                  <div className="small">{m.reason}</div>
                </div>
              ))}
            </Card>
          )}
          <FieldsTable analysis={analysis} />
          <LineItems analysis={analysis} />
        </div>

        <div className="stack">
          <Card title="Next steps" hint="System recommendation">
            <div>
              {analysis.recommendations.next_steps.map((step, i) => (
                <div key={i} className="step">
                  <span className="step-num">{i + 1}</span>
                  <div className="stack" style={{ gap: 2 }}>
                    <span>{step.action}</span>
                    <span className="muted small">{step.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Checks" hint="Plain code, no AI">
            {warnings.length === 0 && infos.length === 0 && <p className="muted small">✓ No check failed.</p>}
            {warnings.map((flag, i) => (
              <div key={`w${i}`} className="flag">
                <span className="badge orange">! warning</span>
                <span>{flag.message}</span>
              </div>
            ))}
            {infos.map((flag, i) => (
              <div key={`i${i}`} className="flag">
                <span className="badge neutral">info</span>
                <span className="muted">{flag.message}</span>
              </div>
            ))}
          </Card>

          {systemFacts.length > 0 && (
            <Card title="System-inferred facts" hint="Not stated by the claimant">
              {systemFacts.map((f, i) => (
                <div key={i} className="row small">
                  <ProvenanceBadge provenance="system_inferred" />
                  <span>{label(f.field)}: <strong>{formatValue(f.field, f.value)}</strong></span>
                  <span className="muted">({sourceLabel(f.source)})</span>
                </div>
              ))}
            </Card>
          )}

          <Card title="AI extraction details" hint="Per document, after the evidence guard">
            {analysis.extractions.length === 0 && <p className="muted small">No documents.</p>}
            {analysis.extractions.map((ext, i) => <ExtractionDetails key={i} extraction={ext} />)}
          </Card>
        </div>
      </div>
    </div>
  )
}
