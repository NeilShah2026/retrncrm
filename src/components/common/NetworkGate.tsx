import * as React from 'react'
import { ErrorState, SlowState } from '@/components/common/EmptyState'
import { LOADING_TIMEOUT_MS } from '@/lib/design-tokens'
import { retryTable, useTableStatus, type TableName } from '@/lib/loadStatus'

interface Props<T> {
  /** The hook's value: undefined while loading. */
  data: T[] | undefined
  /** Which table(s) this collection reads, for error status and retry. */
  table: TableName | TableName[]
  /** Layout-matched placeholder. Shown for at most LOADING_TIMEOUT_MS. */
  skeleton: React.ReactNode
  /** What to render when the collection is loaded but empty. */
  empty: React.ReactNode
  /** Override "empty" — e.g. after filters, or when a different list decides. */
  isEmpty?: (data: T[]) => boolean
  children: (data: T[]) => React.ReactNode
}

/**
 * Every collection in the app renders through this. It guarantees one of
 * four things is on screen, and never a skeleton forever:
 *
 *   loading  → skeleton (≤ 2s)
 *   slow     → "still loading" + reload
 *   failed   → error + retry
 *   loaded   → empty state, or the children
 */
export function NetworkGate<T>({
  data,
  table,
  skeleton,
  empty,
  isEmpty = (d) => d.length === 0,
  children,
}: Props<T>) {
  const tables = Array.isArray(table) ? table : [table]
  const primary = useTableStatus(tables[0])
  const secondary = useTableStatus(tables[1] ?? tables[0])
  const error = primary.error ?? (tables[1] ? secondary.error : null)

  const [slow, setSlow] = React.useState(false)
  React.useEffect(() => {
    if (data !== undefined || error) {
      setSlow(false)
      return
    }
    const elapsed = primary.startedAt ? Date.now() - primary.startedAt : 0
    const t = setTimeout(() => setSlow(true), Math.max(0, LOADING_TIMEOUT_MS - elapsed))
    return () => clearTimeout(t)
  }, [data, error, primary.startedAt])

  function retry() {
    for (const t of tables) retryTable(t)
  }

  if (error) return <ErrorState detail={error} onRetry={retry} />
  if (data === undefined) return slow ? <SlowState onRetry={retry} /> : <>{skeleton}</>
  if (isEmpty(data)) return <>{empty}</>
  return <>{children(data)}</>
}
