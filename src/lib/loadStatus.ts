import * as React from 'react'

/**
 * Load status for the realtime tables, kept outside React so a page can ask
 * "did this table fail?" and "try again" without threading callbacks through
 * every hook. `useRealtimeTable` reports here; `NetworkGate` reads from here.
 *
 * Several components subscribe to the same table at once, and effects can
 * re-run while a request is in flight. So every load is an *attempt*, and
 * only the most recent attempt for a table is allowed to settle the status —
 * an older request finishing late can't overwrite a newer one.
 */
export type TableName = 'contacts' | 'tags' | 'opportunities' | 'templates' | 'events'

interface TableStatus {
  /** The last failure message, or null once a load succeeds. */
  error: string | null
  /** When the current attempt started — the gate times out against this. */
  startedAt: number
  /** Monotonic id of the latest attempt. */
  attempt: number
}

const status = new Map<TableName, TableStatus>()
const reloaders = new Map<TableName, Set<() => void>>()
const listeners = new Set<() => void>()
let seq = 0

function emit() {
  for (const l of listeners) l()
}

/** Begin an attempt. Returns its id; pass it back to markLoaded/markFailed. */
export function markLoading(table: TableName): number {
  seq += 1
  status.set(table, { error: null, startedAt: Date.now(), attempt: seq })
  emit()
  return seq
}

export function markLoaded(table: TableName, attempt: number) {
  const prev = status.get(table)
  if (prev && prev.attempt !== attempt) return
  status.set(table, { error: null, startedAt: prev?.startedAt ?? Date.now(), attempt })
  emit()
}

export function markFailed(table: TableName, message: string, attempt: number) {
  const prev = status.get(table)
  if (prev && prev.attempt !== attempt) return
  status.set(table, { error: message, startedAt: prev?.startedAt ?? Date.now(), attempt })
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
  for (const fn of reloaders.get(table) ?? []) fn()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const EMPTY: TableStatus = { error: null, startedAt: 0, attempt: 0 }

export function useTableStatus(table: TableName): TableStatus {
  return React.useSyncExternalStore(
    subscribe,
    () => status.get(table) ?? EMPTY,
    () => EMPTY,
  )
}
