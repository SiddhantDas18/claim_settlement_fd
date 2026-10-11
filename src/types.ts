// Mirrors the backend schemas (app/schemas/*.py).

export type Role = 'admin' | 'claimant'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
}

// ---- Analysis (app/schemas/analysis.py) ----

export type SourceType = 'hospital_bill' | 'discharge_summary' | 'prescription' | 'lab_report' | 'claimant_email' | 'other'
export type Provenance = 'claimant_form' | 'claimant_document' | 'system_inferred'
export type FieldStatus = 'provided' | 'missing' | 'conflicting' | 'multiple'
export type TriageCategory = 'ready_for_review' | 'needs_more_information' | 'conflicting_information' | 'possible_issue'

export interface FormLineItem {
  description: string
  amount: number
  category?: string | null
}

export interface ClaimForm {
  patient_name?: string | null
  policy_number?: string | null
  hospital_name?: string | null
  invoice_number?: string | null
  admission_date?: string | null
  discharge_date?: string | null
  total_amount?: number | null
  line_items?: FormLineItem[]
  description?: string | null
}

export interface PolicyInfo {
  policy_number?: string | null
  holder_name?: string | null
  start_date?: string | null
  end_date?: string | null
}

export interface SourceDocument {
  name: string
  type: SourceType
  text: string
}

export interface AnalyzeRequest {
  form: ClaimForm
  sources: SourceDocument[]
  policy?: PolicyInfo | null
}

export interface LineItem {
  description: string
  amount: number
  category: string
  category_provenance: 'system_inferred' | 'claimant_form'
  evidence?: string | null
}

export type FactValue = string | number | LineItem[] | string[] | number[] | null

export interface Fact {
  field: string
  value: FactValue
  provenance: Provenance
  source: string
  evidence?: string | null
}

export interface FieldSummary {
  field: string
  status: FieldStatus
  value: FactValue
  provenance: Provenance[]
  sources: string[]
}

export interface MissingField {
  field: string
  reason: string
}

export interface ConflictValue {
  value: FactValue
  source: string
  provenance: Provenance
  evidence?: string | null
}

export interface Conflict {
  field: string
  values: ConflictValue[]
  severity: 'high' | 'medium' | 'low'
}

export interface ValidationFlag {
  code: string
  severity: 'warning' | 'info'
  message: string
  provenance: 'system_inferred'
}

export interface GuardEvent {
  field: string
  value: string | null
  evidence: string | null
  reason: string
}

export interface ExtractedField {
  value: string | number | null
  raw: string | null
  evidence: string | null
}

export interface ExtractionResult {
  source: string
  source_type: SourceType
  detected_type: string | null
  model: string
  prompt_version: string
  fields: Record<string, ExtractedField>
  line_items: LineItem[]
  guard_events: GuardEvent[]
  error: string | null
}

export interface ClaimAnalysis {
  facts: Fact[]
  fields: Record<string, FieldSummary>
  missing_fields: MissingField[]
  conflicts: Conflict[]
  validation_flags: ValidationFlag[]
  recommendations: {
    triage_category: { value: TriageCategory; reason: string; provenance: 'system_inferred' }
    next_steps: { action: string; reason: string; provenance: 'system_inferred' }[]
  }
  extractions: ExtractionResult[]
  model: string
  prompt_version: string
  analyzed_at: string
}

export interface ExampleCase {
  id: string
  category: string
  description: string
  request: AnalyzeRequest
  expected: {
    missing_fields: string[]
    conflicts: string[]
    triage_category: TriageCategory
    flags?: string[]
  }
}

// ---- Claims, plans, payments ----

export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'

export interface ClaimItem {
  id?: number
  category: string
  description: string
  amount: number
  quantity: number
}

export interface ClaimDocument {
  id: number
  doc_type: string
  original_filename: string
  content_type: string
  size_bytes: number
  uploaded_at: string
  extraction_method: string | null
  ocr_confidence: number | null
  extraction_error: string | null
  extracted_text: string | null
}

export interface Payment {
  id: number
  claim_id: number
  amount: number
  currency: string
  status: 'pending' | 'paid'
  method: string | null
  reference: string | null
  created_at: string
  paid_at: string | null
}

export interface Claim {
  id: number
  user_id: number
  policy_id: number
  status: ClaimStatus
  invoice_number: string | null
  treatment_start: string | null
  treatment_end: string | null
  description: string | null
  claimed_amount: number
  triage_category: TriageCategory | null
  approved_amount: number | null
  admin_note: string | null
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
  items: ClaimItem[]
  documents: ClaimDocument[]
  payment: Payment | null
}

export interface Calculation {
  currency: string
  lines: { category: string; description: string; quantity: number; claimed: number; covered: number; note: string }[]
  total_claimed: number
  total_covered: number
  deductible: number
  after_deductible: number
  annual_limit: number
  already_paid: number
  remaining_limit: number
  payable: number
  flags: string[]
}

export interface Plan {
  id: number
  name: string
  currency: string
  deductible: number
  annual_limit: number
  required_documents: string[]
}

export interface Policy {
  id: number
  policy_number: string
  user_id: number
  plan_id: number
  holder_name: string
  start_date: string
  end_date: string
}

export interface PaymentSummary {
  pending_count: number
  pending_amount: number
  paid_count: number
  paid_amount: number
}
