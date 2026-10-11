import { Check, X } from 'lucide-react'
import { Icon } from '../../components/ui'
import type { Claim } from '../../types'

const STAGES = ['Submitted', 'Under review', 'Approved', 'Paid'] as const

/** Submitted → Under review → Approved → Paid, or ending in "Not approved". */
export default function Progress({ claim }: { claim: Claim }) {
  const reached = { draft: 0, submitted: 1, approved: 3, paid: 4, rejected: 2 }[claim.status]
  return (
    <div className="progress" aria-label={`Status: ${claim.status}`}>
      {STAGES.map((stage, i) => {
        const rejectedHere = claim.status === 'rejected' && i === 2
        const done = i < reached
        const cls = rejectedHere ? 'failed' : done ? 'done' : i === reached ? 'current' : ''
        return (
          <span key={stage} className="row" style={{ gap: 0 }}>
            {i > 0 && <span className={`bar${done || rejectedHere ? ' done' : ''}`} />}
            <span className={`stage ${cls}`}>
              <span className="dot" aria-hidden>{rejectedHere ? <Icon icon={X} size={12} /> : done ? <Icon icon={Check} size={12} /> : null}</span>
              {rejectedHere ? 'Not approved' : stage}
            </span>
          </span>
        )
      })}
    </div>
  )
}
