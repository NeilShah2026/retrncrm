import { coldStage, targetName, type ColdStage } from '@/lib/coldEmail'
import type { ColdTarget } from '@/types'

export type ColdFilter = 'all' | 'due' | 'waiting' | 'drafting' | 'replied' | 'done'

export const FILTERS: { key: ColdFilter; label: string; stages: ColdStage[] }[] = [
  { key: 'all', label: 'All', stages: [] },
  { key: 'due', label: 'Follow up', stages: ['due'] },
  { key: 'waiting', label: 'Waiting', stages: ['waiting'] },
  { key: 'drafting', label: 'Drafting', stages: ['drafting'] },
  { key: 'replied', label: 'Replied', stages: ['replied'] },
  { key: 'done', label: 'Done', stages: ['no-reply', 'converted', 'closed'] },
]

/** Stage order inside "All": what needs you, then what's in flight, then what's over. */
const RANK: Record<ColdStage, number> = {
  due: 0,
  replied: 1,
  drafting: 2,
  waiting: 3,
  'no-reply': 4,
  converted: 5,
  closed: 6,
}

export function filterTargets(targets: ColdTarget[], filter: ColdFilter, query: string): ColdTarget[] {
  const stages = FILTERS.find((f) => f.key === filter)?.stages ?? []
  const q = query.trim().toLowerCase()
  return targets
    .filter((t) => stages.length === 0 || stages.includes(coldStage(t)))
    .filter(
      (t) =>
        !q ||
        [targetName(t), t.company, t.role, t.email].some((v) => v?.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const byStage = RANK[coldStage(a)] - RANK[coldStage(b)]
      if (byStage !== 0) return byStage
      // Within a stage, the soonest follow-up, then the newest.
      const byDate = (a.nextFollowUp ?? '9999').localeCompare(b.nextFollowUp ?? '9999')
      return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt)
    })
}
