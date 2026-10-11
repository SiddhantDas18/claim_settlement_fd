import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { Card, Notice } from '../components/ui'
import { date, money } from '../format'
import type { Plan, Policy, User } from '../types'

const YEAR = new Date().getFullYear()

export default function AdminPolicies() {
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [form, setForm] = useState({ user_id: '', plan_id: '', policy_number: '', holder_name: '', start_date: `${YEAR}-01-01`, end_date: `${YEAR}-12-31` })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    api.get<User[]>('/api/v1/admin/users').then(setUsers).catch((e) => setError(e.message))
    api.get<Plan[]>('/api/v1/admin/plans').then((p) => { setPlans(p); setForm((f) => ({ ...f, plan_id: f.plan_id || String(p[0]?.id ?? '') })) }).catch(() => {})
    api.get<Policy[]>('/api/v1/admin/policies').then(setPolicies).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function pickUser(id: string) {
    const user = users.find((u) => String(u.id) === id)
    setForm({ ...form, user_id: id, holder_name: user?.full_name ?? form.holder_name })
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post('/api/v1/admin/policies', { ...form, user_id: Number(form.user_id), plan_id: Number(form.plan_id) })
      setMessage(`Policy ${form.policy_number} created.`)
      setForm({ ...form, policy_number: '', user_id: '', holder_name: '' })
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const userName = (id: number) => users.find((u) => u.id === id)?.full_name ?? `User ${id}`
  const claimants = users.filter((u) => u.role === 'claimant')

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Users & policies</h1><p>A claimant needs a policy before they can file a claim.</p></div>
      </div>
      <div className="split">
        <form onSubmit={create}>
          <Card title="New policy">
            <label className="field">
              Claimant
              <select value={form.user_id} onChange={(e) => pickUser(e.target.value)} required>
                <option value="">Choose…</option>
                {claimants.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
              </select>
            </label>
            <label className="field">
              Plan
              <select value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} required>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currency}, limit {money(p.annual_limit)})</option>)}
              </select>
            </label>
            <div className="grid-2">
              <label className="field">Policy number<input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} required placeholder="POL-26-0001" /></label>
              <label className="field">Holder name<input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} required /></label>
              <label className="field">Start date<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></label>
              <label className="field">End date<input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></label>
            </div>
            <Notice kind="error">{error}</Notice>
            <Notice kind="success">{message}</Notice>
            <button className="primary" disabled={!claimants.length}>Create policy</button>
            {!claimants.length && <p className="muted small">No claimants yet: they can register from the login page.</p>}
          </Card>
        </form>
        <div className="stack">
          <Card title={`Policies (${policies.length})`} flush>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Policy</th><th>Holder</th><th>Account</th><th>Period</th></tr></thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.id}><td>{p.policy_number}</td><td>{p.holder_name}</td><td>{userName(p.user_id)}</td><td className="small">{date(p.start_date)} – {date(p.end_date)}</td></tr>
                  ))}
                  {!policies.length && <tr><td colSpan={4} className="muted">No policies yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title={`Users (${users.length})`} flush>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
                <tbody>{users.map((u) => <tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td><span className="badge neutral">{u.role}</span></td></tr>)}</tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
