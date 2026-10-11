// Display helpers. Amounts use Indian digit grouping: ₹1,24,600.00

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

export function money(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : inr.format(value)
}

export function date(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const FIELD_LABELS: Record<string, string> = {
  patient_name: 'Patient name',
  hospital_name: 'Hospital',
  invoice_number: 'Invoice number',
  admission_date: 'Admission date',
  discharge_date: 'Discharge date',
  total_amount: 'Total amount',
  line_items: 'Itemised charges',
  policy_number: 'Policy number',
  description: 'Description',
  document_type: 'Document type',
  total_amount_all_bills: 'Total of all bills',
}

export function label(field: string): string {
  if (field.startsWith('document:')) return `Document: ${field.slice(9).replaceAll('_', ' ')}`
  return FIELD_LABELS[field] ?? field.replaceAll('_', ' ')
}

export const SOURCE_TYPES = ['hospital_bill', 'discharge_summary', 'prescription', 'lab_report', 'claimant_email', 'other'] as const
export const DOC_TYPES = ['hospital_bill', 'discharge_summary', 'prescription', 'lab_report', 'other'] as const
export const CATEGORIES = ['room', 'medicine', 'diagnostics', 'consultation', 'surgery', 'other'] as const

export function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}

export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (Array.isArray(value)) return value.map((v) => formatValue(field, v)).join(' · ')
  if (typeof value === 'number') return field.includes('amount') || field.includes('total') ? money(value) : String(value)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return date(value)
  return String(value)
}

/** "Hospital bill (bill.pdf)" -> "Hospital bill"; "claim_form" -> "Claim form"; anything else as written. */
export function shortSource(source: string): string {
  if (source === 'claim_form') return 'Claim form'
  if (source === 'system') return 'System'
  // Uploaded documents are named "Hospital bill (bill.pdf)": show the document type, keep the file name for tooltips.
  const uploaded = source.match(/^(.+?) \(([^()]+\.[a-z0-9]{2,5})\)( \(\d+\))?$/i)
  return uploaded ? uploaded[1] : source
}
