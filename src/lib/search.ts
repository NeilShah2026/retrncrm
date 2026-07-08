import Fuse from 'fuse.js'
import type { Contact, Tag } from '@/types'
import { fullName } from './format'
import { INTERACTION_TYPES } from './constants'

/**
 * Build a searchable index across every meaningful field, including notes and
 * interaction summaries — so a query like "guy from the bus who works at
 * Fidelity" matches on howWeMet + company.
 */
export interface SearchRecord {
  contact: Contact
  name: string
  company: string
  jobTitle: string
  industry: string
  howWeMet: string
  whereWeMet: string
  notes: string
  tags: string
  interactions: string
  email: string
}

export function toSearchRecord(
  contact: Contact,
  tagMap: Map<string, Tag>,
): SearchRecord {
  return {
    contact,
    name: fullName(contact),
    company: contact.company ?? '',
    jobTitle: contact.jobTitle ?? '',
    industry: contact.industry ?? '',
    howWeMet: contact.howWeMet ?? '',
    whereWeMet: contact.whereWeMet ?? '',
    notes: contact.notes ?? '',
    tags: contact.tagIds
      .map((id) => tagMap.get(id)?.name ?? '')
      .filter(Boolean)
      .join(' '),
    interactions: contact.interactions
      .map((i) => `${INTERACTION_TYPES[i.type]?.label ?? ''} ${i.summary}`)
      .join(' '),
    email: contact.email ?? '',
  }
}

const FUSE_OPTIONS: import('fuse.js').IFuseOptions<SearchRecord> = {
  includeScore: true,
  threshold: 0.4,
  ignoreLocation: true,
  keys: [
    { name: 'name', weight: 3 },
    { name: 'company', weight: 2 },
    { name: 'jobTitle', weight: 1.5 },
    { name: 'tags', weight: 1.5 },
    { name: 'howWeMet', weight: 1.2 },
    { name: 'whereWeMet', weight: 1.2 },
    { name: 'industry', weight: 1 },
    { name: 'notes', weight: 1 },
    { name: 'interactions', weight: 1 },
    { name: 'email', weight: 1 },
  ],
}

export function buildSearchIndex(
  contacts: Contact[],
  tagMap: Map<string, Tag>,
): Fuse<SearchRecord> {
  const records = contacts.map((c) => toSearchRecord(c, tagMap))
  return new Fuse(records, FUSE_OPTIONS)
}

export function searchContacts(
  fuse: Fuse<SearchRecord>,
  query: string,
): Contact[] {
  const q = query.trim()
  if (!q) return []
  return fuse.search(q).map((r) => r.item.contact)
}
