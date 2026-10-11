import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api'
import { Notice } from '../../components/ui'
import { date, money } from '../../format'
import type { Plan, Policy, User } from '../../types'

const YEAR = new Date().getFullYear()

export default function Settings() {
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [form, setForm] = useState({ user_id: '', policy_number: '', holder_name: '', start_date: `${YEAR}-01-01`, end_date: `${YEAR}-12-31` })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    api.get<User[]>('/api/v1/admin/users').then(setUsers).catch((e) => setError(e.message))
    api.get<Plan[]>('/api/v1/admin/plans').then(setPlans).catch(() => {})
    api.get<Policy[]>('/api/v1/admin/policies').then(setPolicies).catch(() => {})
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const claimants = users.filter((u) => u.role === 'claimant')
  const withoutPolicy = claimants.filter((u) => !policies.some((p) => p.user_id === u.id))
  const plan = plans[0]

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post('/api/v1/admin/policies', { ...form, user_id: Number(form.user_id), plan_id: plan.id })
      setMessage(`Policy ${form.policy_number} added. The claimant can now file a claim.`)
      setForm({ ...form, user_id: '', policy_number: '', holder_name: '' })
      load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head"><div><h1>Settings</h1><p>Claimants register themselves; give them a policy here so they can file claims.</p></div></div>

      <section className="block">
        <div className="block-head"><h2>Give a claimant a policy</h2>{withoutPolicy.length > 0 && <span className="badge warn">{withoutPolicy.length} waiting</span>}</div>
        <form className="block-body" onSubmit={create}>
          {claimants.length === 0 ? (
            <p className="muted">No claimants yet. They can create an account on the login page.</p>
          ) : (
            <>
              <div className="grid-2">
                <label className="field">
                  Claimant
                  <select value={form.user_id} required onChange={(e) => setForm({ ...form, user_id: e.target.value, holder_name: users.find((u) => String(u.id) === e.target.value)?.full_name ?? '' })}>
                    <option value="">Choose…</option>
                    {claimants.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email}){withoutPolicy.includes(u) ? ' · no policy yet' : ''}</option>)}
                  </select>
                </label>
                <label className="field">Policy number<input value={form.policy_number} required placeholder="POL-26-0001" onChange={(e) => setForm({ ...form, policy_number: e.target.value })} /></label>
                <label className="field">Covered from<input type="date" value={form.start_date} required onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
                <label className="field">Covered until<input type="date" value={form.end_date} required onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
              </div>
              {plan && <p className="muted small">Plan: {plan.name} · annual limit {money(plan.annual_limit)} · deductible {money(plan.deductible)} per claim</p>}
              <div className="row"><button className="primary" disabled={!plan}>Add policy</button></div>
            </>
          )}
          <Notice kind="error">{error}</Notice>
          <Notice kind="success">{message}</Notice>
        </form>
      </section>

      <section className="block">
        <div className="block-head"><h2>Claimants</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Policy</th></tr></thead>
            <tbody>
              {claimants.map((u) => {
                const p = policies.find((x) => x.user_id === u.id)
                return <tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td>{p ? <>{p.policy_number} <span className="muted small">({date(p.start_date)} – {date(p.end_date)})</span></> : <span className="badge warn">none yet</span>}</td></tr>
              })}
              {claimants.length === 0 && <tr><td colSpan={3} className="muted">No claimants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
