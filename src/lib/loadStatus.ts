import * as React from 'react'

/**
 * Load status for the realtime tables, kept outside React so a page can ask
 * "did this table fail?" and "try again" without threading callbacks through
 * every hook. `useRealtimeTable` reports here; `NetworkGate` reads from here.
 */
export type TableName = 'contacts' | 'tags' | 'opportunities' | 'templates' | 'events'

interface TableStatus {
  /** The last failure message, or null once a load succeeds. */
  error: string | null
  /** When the current attempt started — the gate times out against this. */
  startedAt: number
}

const status = new Map<TableName, TableStatus>()
const reloaders = new Map<TableName, Set<() => void>>()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function markLoading(table: TableName) {
  status.set(table, { error: null, startedAt: Date.now() })
  emit()
}

export function markLoaded(table: TableName) {
  const prev = status.get(table)
  status.set(table, { error: null, startedAt: prev?.startedAt ?? Date.now() })
  emit()
}

export function markFailed(table: TableName, message: string) {
  const prev = status.get(table)
  status.set(table, { error: message, startedAt: prev?.startedAt ?? Date.now() })
  emit()
}

/** A hook registers how to re-run its own fetch; the gate's Retry calls it. */
export function registerReloader(table: TableName, fn: () => void): () => void {
  let set = reloaders.get(table)
  if (!set) {
    set = new Set()
    reloaders.set(table, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
  }
}

export function retryTable(table: TableName) {
  markLoading(table)
  for (const fn of reloaders.get(table) ?? []) fn()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const EMPTY: TableStatus = { error: null, startedAt: 0 }

export function useTableStatus(table: TableName): TableStatus {
  return React.useSyncExternalStore(
    subscribe,
    () => status.get(table) ?? EMPTY,
    () => EMPTY,
  )
}
