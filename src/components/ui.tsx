import type { ReactNode } from 'react'
import { humanize } from '../format'
import type { ClaimStatus, FieldStatus, Provenance, TriageCategory } from '../types'

const STATUS: Record<FieldStatus, { icon: string; text: string }> = {
  provided: { icon: '✓', text: 'Provided' },
  missing: { icon: '?', text: 'Missing' },
  conflicting: { icon: '⇄', text: 'Conflicting' },
  multiple: { icon: '≡', text: 'Multiple bills' },
}

export function StatusBadge({ status }: { status: FieldStatus }) {
  const s = STATUS[status]
  return (
    <span className={`badge ${status}`}>
      <span className="icon" aria-hidden>{s.icon}</span>
      {s.text}
    </span>
  )
}

/** Where a fact came from. System-inferred items always look different from claimant facts. */
export function ProvenanceBadge({ provenance, source }: { provenance: Provenance; source?: string }) {
  if (provenance === 'system_inferred') {
    return (
      <span className="badge system" title="Produced by the system, not stated by the claimant">
        <span className="icon" aria-hidden>✦</span>System inferred
      </span>
    )
  }
  if (provenance === 'claimant_form') {
    return (
      <span className="badge form" title="Typed by the claimant on the claim form">
        <span className="icon" aria-hidden>✎</span>Claim form
      </span>
    )
  }
  return (
    <span className="badge doc" title="Read from a document the claimant submitted">
      <span className="icon" aria-hidden>▤</span>
      {source ? `Document: ${source}` : 'Claimant document'}
    </span>
  )
}

const TRIAGE: Record<TriageCategory, { cls: string; icon: string; text: string }> = {
  ready_for_review: { cls: 'ok', icon: '✓', text: 'Ready for review' },
  needs_more_information: { cls: 'warn', icon: '?', text: 'Needs more information' },
  conflicting_information: { cls: 'bad', icon: '⇄', text: 'Conflicting information' },
  possible_issue: { cls: 'orange', icon: '!', text: 'Possible issue' },
}

export function TriageChip({ value, large }: { value: TriageCategory | null | undefined; large?: boolean }) {
  if (!value) return <span className="badge neutral">Not analysed</span>
  const t = TRIAGE[value]
  return (
    <span className={`badge ${t.cls}${large ? ' lg' : ''}`}>
      <span className="icon" aria-hidden>{t.icon}</span>
      {t.text}
    </span>
  )
}

const CLAIM_STATUS: Record<ClaimStatus, string> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'ok',
  rejected: 'bad',
  paid: 'system',
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`badge ${CLAIM_STATUS[status]}`}>{humanize(status)}</span>
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />
}

export function Notice({ kind, children }: { kind: 'error' | 'success' | 'info' | 'warn'; children: ReactNode }) {
  if (!children) return null
  return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : undefined}>{children}</div>
}

export function Card({ title, hint, actions, children, flush }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {hint && <span className="hint">{hint}</span>}
          {actions && <><span className="spacer" />{actions}</>}
        </div>
      )}
      <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  )
}

export function Quote({ text }: { text: string | null | undefined }) {
  if (!text) return <div className="quote none">No quote: typed on the claim form or computed by the system</div>
  return <div className="quote">“{text}”</div>
}
