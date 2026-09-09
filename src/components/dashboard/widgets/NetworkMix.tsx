import * as React from 'react'
import { Link } from 'react-router-dom'
import { Gauge } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { STRENGTH_LABELS } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

interface Props {
  contacts: Contact[]
}

/** Cool for an acquaintance through to warm for someone close. */
const BAR_COLOR: Record<number, string> = {
  1: 'bg-slate-400',
  2: 'bg-sky-400',
  3: 'bg-indigo-400',
  4: 'bg-violet-500',
  5: 'bg-emerald-500',
}

/**
 * How close the network actually is, counted by relationship strength.
 *
 * Total contacts is a vanity number — five hundred people you rated a 1 is a
 * mailing list. This splits the same total into the ties you'd actually call
 * on, which is the number worth watching over a semester.
 */
export function NetworkMix({ contacts }: Props) {
  const { rows, strong } = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]
    for (const c of contacts) {
      const n = Math.min(5, Math.max(1, Math.round(c.relationshipStrength || 1)))
      counts[n]++
    }
    return {
      rows: [5, 4, 3, 2, 1].map((n) => ({ level: n, count: counts[n] })),
      strong: counts[4] + counts[5],
    }
  }, [contacts])

  const max = Math.max(1, ...rows.map((r) => r.count))
  const share = contacts.length ? Math.round((strong / contacts.length) * 100) : 0

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold">Network mix</h2>
          </div>
          <Link
            to={ROUTES.contacts}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Contacts
          </Link>
        </div>

        {contacts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing to weigh up yet.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{strong}</span> of{' '}
              {contacts.length} are strong ties — {share}%.
            </p>
            <ul className="space-y-2">
              {rows.map(({ level, count }) => (
                <li key={level} className="flex items-center gap-2.5">
                  <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                    {STRENGTH_LABELS[level]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', BAR_COLOR[level])}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
