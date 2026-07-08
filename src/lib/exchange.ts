import type { Contact, Opportunity, OutreachTemplate, Tag } from '@/types'
import { FREQUENCY_OPTIONS } from './constants'

export const EXPORT_VERSION = 2

export interface ExportBundle {
  app: 'retrn-crm'
  version: number
  exportedAt: string
  contacts: Contact[]
  tags: Tag[]
  opportunities: Opportunity[]
  templates: OutreachTemplate[]
}

export function buildExportBundle(
  contacts: Contact[],
  tags: Tag[],
  opportunities: Opportunity[],
  templates: OutreachTemplate[],
): ExportBundle {
  return {
    app: 'retrn-crm',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    contacts,
    tags,
    opportunities,
    templates,
  }
}

/** Trigger a browser download for arbitrary text content. */
export function downloadFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function datestamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export function exportJson(
  contacts: Contact[],
  tags: Tag[],
  opportunities: Opportunity[],
  templates: OutreachTemplate[],
): void {
  const bundle = buildExportBundle(contacts, tags, opportunities, templates)
  downloadFile(
    `retrn-export-${datestamp()}.json`,
    JSON.stringify(bundle, null, 2),
    'application/json',
  )
}

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const CSV_HEADERS = [
  'First Name',
  'Last Name',
  'Company',
  'Job Title',
  'Industry',
  'Email',
  'Phone',
  'LinkedIn',
  'Twitter/X',
  'How We Met',
  'Where We Met',
  'Date Met',
  'Tags',
  'Relationship Strength',
  'Last Contact',
  'Contact Frequency Goal',
  'Interactions',
  'Notes',
]

export function exportCsv(contacts: Contact[], tags: Tag[]): void {
  const tagMap = new Map(tags.map((t) => [t.id, t.name]))
  const rows = contacts.map((c) => [
    c.firstName,
    c.lastName,
    c.company ?? '',
    c.jobTitle ?? '',
    c.industry ?? '',
    c.email ?? '',
    c.phone ?? '',
    c.linkedinUrl ?? '',
    c.twitter ?? '',
    c.howWeMet ?? '',
    c.whereWeMet ?? '',
    c.dateMet ?? '',
    c.tagIds.map((id) => tagMap.get(id) ?? '').filter(Boolean).join('; '),
    String(c.relationshipStrength),
    c.lastContactDate ?? '',
    FREQUENCY_OPTIONS[c.contactFrequencyGoal]?.label ?? '',
    String(c.interactions.length),
    c.notes ?? '',
  ])
  const csv = [CSV_HEADERS, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
  downloadFile(`retrn-contacts-${datestamp()}.csv`, csv, 'text/csv')
}

export interface ParsedImport {
  contacts: Contact[]
  tags: Tag[]
  opportunities: Opportunity[]
  templates: OutreachTemplate[]
}

/** Validate and normalize an imported JSON bundle. Throws on invalid input. */
export function parseImportBundle(raw: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('The file is not valid JSON.')
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Unexpected file format.')
  }
  const bundle = data as Partial<ExportBundle>
  if (!Array.isArray(bundle.contacts)) {
    throw new Error('No contacts found in this file.')
  }

  const tags: Tag[] = Array.isArray(bundle.tags)
    ? bundle.tags.map(normalizeTag).filter((t): t is Tag => t !== null)
    : []
  const contacts: Contact[] = bundle.contacts
    .map(normalizeContact)
    .filter((c): c is Contact => c !== null)
  const opportunities: Opportunity[] = Array.isArray(bundle.opportunities)
    ? (bundle.opportunities.filter(
        (o) => o && typeof o === 'object' && typeof (o as Opportunity).id === 'string',
      ) as Opportunity[])
    : []
  const templates: OutreachTemplate[] = Array.isArray(bundle.templates)
    ? (bundle.templates.filter(
        (t) =>
          t && typeof t === 'object' && typeof (t as OutreachTemplate).id === 'string',
      ) as OutreachTemplate[])
    : []

  if (contacts.length === 0) {
    throw new Error('No valid contacts found in this file.')
  }
  return { contacts, tags, opportunities, templates }
}

function normalizeTag(t: unknown): Tag | null {
  if (!t || typeof t !== 'object') return null
  const tag = t as Record<string, unknown>
  if (typeof tag.id !== 'string' || typeof tag.name !== 'string') return null
  return {
    id: tag.id,
    name: tag.name,
    color: typeof tag.color === 'string' ? tag.color : 'slate',
    createdAt:
      typeof tag.createdAt === 'string'
        ? tag.createdAt
        : new Date().toISOString(),
  }
}

function normalizeContact(c: unknown): Contact | null {
  if (!c || typeof c !== 'object') return null
  const o = c as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.firstName !== 'string') return null
  const now = new Date().toISOString()
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const strengthRaw = Number(o.relationshipStrength)
  return {
    id: o.id,
    firstName: o.firstName,
    lastName: typeof o.lastName === 'string' ? o.lastName : '',
    photo: str(o.photo),
    company: str(o.company),
    jobTitle: str(o.jobTitle),
    industry: str(o.industry),
    linkedinUrl: str(o.linkedinUrl),
    email: str(o.email),
    phone: str(o.phone),
    twitter: str(o.twitter),
    otherLinks: Array.isArray(o.otherLinks)
      ? (o.otherLinks as Contact['otherLinks'])
      : [],
    howWeMet: str(o.howWeMet),
    whereWeMet: str(o.whereWeMet),
    dateMet: str(o.dateMet),
    tagIds: Array.isArray(o.tagIds)
      ? (o.tagIds.filter((x) => typeof x === 'string') as string[])
      : [],
    relationshipStrength:
      strengthRaw >= 1 && strengthRaw <= 5 ? strengthRaw : 3,
    lastContactDate: str(o.lastContactDate),
    contactFrequencyGoal:
      typeof o.contactFrequencyGoal === 'string' &&
      o.contactFrequencyGoal in FREQUENCY_OPTIONS
        ? (o.contactFrequencyGoal as Contact['contactFrequencyGoal'])
        : 'none',
    notes: str(o.notes),
    interactions: Array.isArray(o.interactions)
      ? (o.interactions as Contact['interactions'])
      : [],
    createdAt: str(o.createdAt) ?? now,
    updatedAt: str(o.updatedAt) ?? now,
  }
}
