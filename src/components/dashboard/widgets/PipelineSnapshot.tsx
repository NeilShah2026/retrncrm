import * as React from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, KanbanSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_KEYS } from '@/lib/constants'
import { daysSince, formatDate } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Opportunity } from '@/types'

interface Props {
  opportunities: Opportunity[]
}

/** How many days out a deadline still counts as "coming up". */
const DEADLINE_HORIZON = 21

/**
 * The board, flattened to a line of counts and the deadlines close enough to
 * matter. Everything here is also on the pipeline page — this is the version
 * you can take in without going there.
 */
export function PipelineSnapshot({ opportunities }: Props) {
  const { byStage, upcomingDeadlines, total } = React.useMemo(() => {
    const stages: Record<Opportunity['stage'], number> = {
      researching: 0,
      applied: 0,
      interviewing: 0,
      offer: 0,
      closed: 0,
    }
    for (const o of opportunities) stages[o.stage]++

    const deadlines = opportunities
      .filter((o) => {
        if (!o.deadline || o.stage === 'closed') return false
        const d = daysSince(o.deadline)
        return d !== null && d <= 0 && d >= -DEADLINE_HORIZON
      })
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
      .slice(0, 6)

    return {
      byStage: stages,
      upcomingDeadlines: deadlines,
      total: opportunities.length,
    }
  }, [opportunities])

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold">Recruiting pipeline</h2>
          </div>
          <Link
            to={ROUTES.pipeline}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open board
          </Link>
        </div>

        {total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No opportunities tracked yet.{' '}
            <Link to={ROUTES.pipeline} className="text-indigo-500 hover:underline">
              Add your first one
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {OPPORTUNITY_STAGE_KEYS.map((stage) => {
                const count = byStage[stage]
                if (count === 0) return null
                const s = OPPORTUNITY_STAGES[stage]
                return (
                  <Link
                    key={stage}
                    to={ROUTES.pipeline}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                    <span>{s.label}</span>
                    <span className="font-semibold">{count}</span>
                  </Link>
                )
              })}
            </div>

            {upcomingDeadlines.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Deadlines coming up
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingDeadlines.map((o) => (
                    <Link
                      key={o.id}
                      to={ROUTES.pipeline}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.company}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.role} · due {formatDate(o.deadline)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
