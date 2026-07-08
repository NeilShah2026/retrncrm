import type { Contact, ConnectionType, MeetSource } from '@/types'
import { fullName } from './format'
import { isOverdue } from './reconnect'

export interface ContactFilters {
  tagIds: string[]
  companies: string[]
  industries: string[]
  whereMet: string[]
  connectionTypes: ConnectionType[]
  sources: MeetSource[]
  strengths: number[]
  /** ISO dates for dateMet range. */
  metFrom?: string
  metTo?: string
  overdueOnly: boolean
}

export const EMPTY_FILTERS: ContactFilters = {
  tagIds: [],
  companies: [],
  industries: [],
  whereMet: [],
  connectionTypes: [],
  sources: [],
  strengths: [],
  overdueOnly: false,
}

export function hasActiveFilters(f: ContactFilters): boolean {
  return countActiveFilters(f) > 0
}

export function countActiveFilters(f: ContactFilters): number {
  return (
    f.tagIds.length +
    f.companies.length +
    f.industries.length +
    f.whereMet.length +
    f.connectionTypes.length +
    f.sources.length +
    f.strengths.length +
    (f.overdueOnly ? 1 : 0) +
    (f.metFrom ? 1 : 0) +
    (f.metTo ? 1 : 0)
  )
}

export function applyFilters(
  contacts: Contact[],
  f: ContactFilters,
): Contact[] {
  return contacts.filter((c) => {
    if (f.tagIds.length && !f.tagIds.every((t) => c.tagIds.includes(t)))
      return false
    if (f.companies.length && !f.companies.includes(c.company ?? '')) return false
    if (f.industries.length && !f.industries.includes(c.industry ?? ''))
      return false
    if (f.whereMet.length && !f.whereMet.includes(c.whereWeMet ?? ''))
      return false
    if (
      f.connectionTypes.length &&
      (!c.connectionType || !f.connectionTypes.includes(c.connectionType))
    )
      return false
    if (f.sources.length && (!c.source || !f.sources.includes(c.source)))
      return false
    if (f.strengths.length && !f.strengths.includes(c.relationshipStrength))
      return false
    if (f.metFrom && (!c.dateMet || c.dateMet < f.metFrom)) return false
    if (f.metTo && (!c.dateMet || c.dateMet > f.metTo)) return false
    if (f.overdueOnly && !isOverdue(c)) return false
    return true
  })
}

/** Distinct, sorted values for a field across all contacts (for filter menus). */
export function distinctValues(
  contacts: Contact[],
  key: 'company' | 'industry' | 'whereWeMet',
): string[] {
  const set = new Set<string>()
  for (const c of contacts) {
    const v = c[key]
    if (v && v.trim()) set.add(v.trim())
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export type SortKey =
  | 'name'
  | 'company'
  | 'lastContact'
  | 'dateMet'
  | 'strength'
export type SortDir = 'asc' | 'desc'

export function sortContacts(
  contacts: Contact[],
  key: SortKey,
  dir: SortDir,
): Contact[] {
  const factor = dir === 'asc' ? 1 : -1
  const sorted = [...contacts].sort((a, b) => {
    switch (key) {
      case 'name':
        return factor * fullName(a).localeCompare(fullName(b))
      case 'company':
        return factor * (a.company ?? '').localeCompare(b.company ?? '')
      case 'strength':
        return factor * (a.relationshipStrength - b.relationshipStrength)
      case 'lastContact': {
        // Empty dates sort last regardless of direction.
        const av = a.lastContactDate ?? ''
        const bv = b.lastContactDate ?? ''
        if (!av && !bv) return 0
        if (!av) return 1
        if (!bv) return -1
        return factor * av.localeCompare(bv)
      }
      case 'dateMet': {
        const av = a.dateMet ?? ''
        const bv = b.dateMet ?? ''
        if (!av && !bv) return 0
        if (!av) return 1
        if (!bv) return -1
        return factor * av.localeCompare(bv)
      }
      default:
        return 0
    }
  })
  return sorted
}
