import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  CircleHelp,
  FileText,
  Info,
  Layers,
  Loader2,
  PenLine,
  ShieldPlus,
  Sparkles,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { humanize } from '../format'
import type { ClaimStatus, FieldStatus, Provenance, TriageCategory } from '../types'

/** One size and stroke for every icon in the app. Icons are decorative: the text next to them carries the meaning. */
export function Icon({ icon: Glyph, size = 16, className }: { icon: LucideIcon; size?: number; className?: string }) {
  return <Glyph size={size} strokeWidth={2} className={`icon ${className ?? ''}`} aria-hidden />
}

export function Brand({ size = 15 }: { size?: number }) {
  return <span className="brand-mark"><Icon icon={ShieldPlus} size={size} /></span>
}

const STATUS: Record<FieldStatus, { icon: LucideIcon; text: string }> = {
  provided: { icon: CheckCircle2, text: 'Provided' },
  missing: { icon: CircleHelp, text: 'Missing' },
  conflicting: { icon: ArrowLeftRight, text: 'Documents disagree' },
  multiple: { icon: Layers, text: 'Multiple bills' },
}

export function StatusBadge({ status }: { status: FieldStatus }) {
  const s = STATUS[status]
  return <span className={`badge ${status}`}><Icon icon={s.icon} size={13} />{s.text}</span>
}

export function ProvenanceBadge({ provenance, source }: { provenance: Provenance; source?: string }) {
  if (provenance === 'system_inferred') return <span className="badge system" title="Produced by the system, not stated by the claimant"><Icon icon={Sparkles} size={13} />System inferred</span>
  if (provenance === 'claimant_form') return <span className="badge form" title="Typed by the claimant on the claim form"><Icon icon={PenLine} size={13} />Claim form</span>
  return <span className="badge doc" title="Read from a document the claimant submitted"><Icon icon={FileText} size={13} />{source ? `Document: ${source}` : 'Claimant document'}</span>
}

const TRIAGE: Record<TriageCategory, { cls: string; icon: LucideIcon; text: string }> = {
  ready_for_review: { cls: 'ok', icon: CheckCircle2, text: 'Ready for review' },
  needs_more_information: { cls: 'warn', icon: CircleHelp, text: 'Needs more information' },
  conflicting_information: { cls: 'bad', icon: ArrowLeftRight, text: 'Conflicting information' },
  possible_issue: { cls: 'orange', icon: TriangleAlert, text: 'Possible issue' },
}

export function TriageChip({ value, large }: { value: TriageCategory | null | undefined; large?: boolean }) {
  if (!value) return <span className="badge neutral">Not checked yet</span>
  const t = TRIAGE[value]
  return <span className={`badge ${t.cls}${large ? ' lg' : ''}`}><Icon icon={t.icon} size={large ? 16 : 13} />{t.text}</span>
}

const CLAIM_STATUS: Record<ClaimStatus, string> = { draft: 'neutral', submitted: 'info', approved: 'ok', rejected: 'bad', paid: 'system' }

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`badge ${CLAIM_STATUS[status]}`}>{humanize(status)}</span>
}

export function Spinner({ size = 16, label = 'Loading' }: { size?: number; label?: string }) {
  return <span role="status" aria-label={label} className="spinner-wrap"><Icon icon={Loader2} size={size} className="spin" /></span>
}

const NOTICE_ICON: Record<string, LucideIcon> = { error: XCircle, success: CheckCircle2, info: Info, warn: TriangleAlert }

export function Notice({ kind, children }: { kind: 'error' | 'success' | 'info' | 'warn'; children: ReactNode }) {
  if (!children) return null
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon icon={NOTICE_ICON[kind]} size={18} />
      <div className="notice-text">{children}</div>
    </div>
  )
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button className="link back" onClick={onClick}><Icon icon={ArrowLeft} size={15} />{children}</button>
}

/** Grey placeholder bars while data loads. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-wrap" aria-hidden>
      {Array.from({ length: lines }, (_, i) => <span key={i} className="skeleton" style={{ width: `${92 - i * 14}%` }} />)}
    </div>
  )
}
