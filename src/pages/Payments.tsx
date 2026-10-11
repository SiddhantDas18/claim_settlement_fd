import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Card, Notice, Spinner } from '../components/ui'
import { dateTime, money } from '../format'
import { navigate } from '../router'
import type { Payment, PaymentSummary } from '../types'

function MarkPaid({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const [method, setMethod] = useState('upi')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/v1/admin/payments/${payment.id}/mark-paid`, { method, reference: reference || null })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 'auto' }} aria-label="Payment method">
        <option value="upi">UPI</option>
        <option value="bank">Bank transfer (NEFT/IMPS)</option>
        <option value="cheque">Cheque</option>
        <option value="cash">Cash</option>
      </select>
      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference (UTR)" style={{ width: 160 }} aria-label="Reference" />
      <button className="small primary" disabled={busy} onClick={submit}>Mark paid</button>
      {error && <span className="badge bad">{error}</span>}
    </div>
  )
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [filter, setFilter] = useState('pending')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get<Payment[]>(`/api/v1/admin/payments${filter ? `?status=${filter}` : ''}`).then(setPayments).catch((e) => setError(e.message))
    api.get<PaymentSummary>('/api/v1/admin/payments/summary').then(setSummary).catch(() => {})
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Payments</h1><p>Payouts created when a claim is approved.</p></div>
        <label className="field">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="">All</option>
          </select>
        </label>
      </div>
      <Notice kind="error">{error}</Notice>
      {summary && (
        <div className="grid-2">
          <div className="card stat"><div className="muted small">Pending ({summary.pending_count})</div><div className="num">{money(summary.pending_amount)}</div></div>
          <div className="card stat"><div className="muted small">Paid ({summary.paid_count})</div><div className="num">{money(summary.paid_amount)}</div></div>
        </div>
      )}
      <Card flush>
        {payments === null ? (
          <div className="empty"><Spinner /></div>
        ) : payments.length === 0 ? (
          <div className="empty">No payments here.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payment</th><th>Claim</th><th className="num">Amount</th><th>Created</th><th>Status</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td><button className="link" onClick={() => navigate(`/claims/${p.claim_id}`)}>Claim #{p.claim_id}</button></td>
                    <td className="num">{money(p.amount)}</td>
                    <td className="small">{dateTime(p.created_at)}</td>
                    <td>
                      {p.status === 'paid' ? (
                        <span className="small"><span className="badge ok">✓ paid</span> {p.method?.toUpperCase()} {p.reference} · {dateTime(p.paid_at)}</span>
                      ) : (
                        <MarkPaid payment={p} onDone={load} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
