import * as React from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { COLD_STAGES, coldStage, shortDate, sortedSends, targetName, type ColdStage } from '@/lib/coldEmail'
import { FILTERS, type ColdFilter } from './filters'
import { cn } from '@/lib/utils'
import type { ColdTarget } from '@/types'

/** The left pane: who you're writing to, what needs doing first. */
export function TargetList({
  targets,
  visible,
  selectedId,
  onSelect,
  filter,
  onFilter,
  query,
  onQuery,
}: {
  /** All of them, for the filter counts. */
  targets: ColdTarget[]
  /** After filtering and search. */
  visible: ColdTarget[]
  selectedId: string | null
  onSelect: (id: string) => void
  filter: ColdFilter
  onFilter: (f: ColdFilter) => void
  query: string
  onQuery: (q: string) => void
}) {
  const counts = React.useMemo(() => {
    const byStage = new Map<ColdStage, number>()
    for (const t of targets) {
      const s = coldStage(t)
      byStage.set(s, (byStage.get(s) ?? 0) + 1)
    }
    return Object.fromEntries(
      FILTERS.map((f) => [
        f.key,
        f.stages.length === 0 ? targets.length : f.stages.reduce((n, s) => n + (byStage.get(s) ?? 0), 0),
      ]),
    ) as Record<ColdFilter, number>
  }, [targets])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search name, company, email"
            aria-label="Search cold emails"
            className="h-8 pl-8"
          />
        </div>
        <div role="tablist" aria-label="Filter by stage" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => onFilter(f.key)}
              disabled={f.key !== 'all' && counts[f.key] === 0 && filter !== f.key}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40',
                filter === f.key
                  ? 'bg-bg-sunken text-foreground'
                  : 'text-muted-foreground hover:bg-bg-sunken/60 hover:text-foreground',
              )}
            >
              {f.label}
              <span className={cn('tnum', f.key === 'due' && counts.due > 0 && 'text-warning')}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {query.trim() ? `Nobody matches “${query.trim()}”.` : 'Nobody here.'}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="People you’re emailing">
          {visible.map((t) => (
            <Row key={t.id} target={t} selected={t.id === selectedId} onSelect={() => onSelect(t.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ target, selected, onSelect }: { target: ColdTarget; selected: boolean; onSelect: () => void }) {
  const stage = coldStage(target)
  const last = sortedSends(target.sends).at(-1)
  const when =
    stage === 'due' || stage === 'waiting'
      ? target.nextFollowUp && shortDate(target.nextFollowUp)
      : last && shortDate(last.date)

  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
          selected ? 'bg-bg-sunken' : 'hover:bg-bg-sunken/60',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{targetName(target)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[target.company, target.role].filter(Boolean).join(' · ') || target.email || '—'}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={COLD_STAGES[stage].tone}>{COLD_STAGES[stage].label}</Badge>
          {when && <span className="tnum text-xs text-muted-foreground">{when}</span>}
        </span>
      </button>
    </li>
  )
}
