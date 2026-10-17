import { contactRepo, keyDateRepo, type ContactDraft } from '@/services'
import { ensureTags } from '@/lib/tagging'
import { createId } from '@/lib/utils'
import type { Contact, KeyDate, Tag } from '@/types'
import { FIELD_BY_KEY, IGNORE, TEMPLATE_EXAMPLE_EMAIL, type ImportField } from './fields'
import type { ColumnMapping } from './mapping'
import {
  cleanEmail,
  cleanGradYear,
  cleanLinkedin,
  cleanTwitter,
  cleanWebsite,
  formatBirthday,
  isEmail,
  parseBirthday,
  parseDate,
  splitName,
  splitTags,
} from './values'

/** The fields a review row holds — everything but `fullName`, which is split. */
export type RowField = Exclude<ImportField, 'fullName'>
export type RowValues = Partial<Record<RowField, string>>

export interface ImportRow {
  /** The sheet row it came from, as Excel numbers it (1-based). */
  sheetRow: number
  values: RowValues
}

export type RowStatus =
  | { kind: 'ready'; warnings: string[] }
  | { kind: 'needs-name' }
  | { kind: 'existing'; contactId: string }
  | { kind: 'repeat'; ofSheetRow: number }

/** Turn the sheet into rows of Retrn fields, using the chosen mapping. */
export function deriveRows(rows: string[][], mapping: ColumnMapping): ImportRow[] {
  const headers = mapping.headerRow >= 0 ? rows[mapping.headerRow] ?? [] : []
  const out: ImportRow[] = []

  rows.forEach((row, index) => {
    if (index <= mapping.headerRow) return
    const values: RowValues = {}
    const notes: string[] = []
    const tags: string[] = []
    const noteColumns = mapping.columns.filter((c) => c === 'notes').length

    mapping.columns.forEach((target, col) => {
      const cell = (row[col] ?? '').trim()
      if (!cell || target === IGNORE) return
      switch (target) {
        case 'fullName': {
          const { firstName, lastName } = splitName(cell)
          values.firstName ??= firstName
          values.lastName ??= lastName
          break
        }
        case 'notes':
          // Several note columns keep their headers, so "Hobbies: sailing"
          // doesn't arrive as an unexplained "sailing".
          notes.push(noteColumns > 1 && headers[col] ? `${headers[col]}: ${cell}` : cell)
          break
        case 'tags':
          tags.push(...splitTags(cell))
          break
        default:
          values[target] = cell
      }
    })
    if (notes.length) values.notes = notes.join('\n')
    if (tags.length) values.tags = [...new Set(tags)].join(', ')

    if (Object.keys(values).length === 0) return
    const clean = normalize(values)
    // The template's own example row, left in by someone who typed below it.
    if (clean.email === TEMPLATE_EXAMPLE_EMAIL) return
    out.push({ sheetRow: index + 1, values: clean })
  })
  return out
}

/** Tidy each value into the shape Retrn stores — leaving it alone if it can't. */
export function normalize(values: RowValues): RowValues {
  const v = { ...values }
  if (v.email) v.email = cleanEmail(v.email)
  if (v.linkedinUrl) v.linkedinUrl = cleanLinkedin(v.linkedinUrl)
  if (v.twitter) v.twitter = cleanTwitter(v.twitter)
  if (v.website) v.website = cleanWebsite(v.website)
  if (v.gradYear) v.gradYear = cleanGradYear(v.gradYear)
  if (v.dateMet) v.dateMet = parseDate(v.dateMet) ?? v.dateMet
  if (v.lastContactDate) v.lastContactDate = parseDate(v.lastContactDate) ?? v.lastContactDate
  if (v.birthday) {
    const b = parseBirthday(v.birthday)
    if (b) v.birthday = formatBirthday(b)
  }
  return v
}

/** What's wrong with a row's values, in words — nothing here blocks an import. */
function warningsFor(v: RowValues): string[] {
  const out: string[] = []
  if (v.email && !isEmail(v.email)) out.push(`“${v.email}” isn’t an email address — it will be left out`)
  if (v.dateMet && !parseDate(v.dateMet)) out.push(`Can’t read the date met “${v.dateMet}”`)
  if (v.lastContactDate && !parseDate(v.lastContactDate))
    out.push(`Can’t read the last-contacted date “${v.lastContactDate}”`)
  if (v.birthday && !parseBirthday(v.birthday)) out.push(`Can’t read the birthday “${v.birthday}”`)
  return out
}

const digits = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-10)
const nameKey = (v: { firstName?: string; lastName?: string }) =>
  `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim().toLowerCase()

/**
 * Each row's status: ready, missing a name, already in Retrn (same email,
 * phone or full name — the same rule the phone-contacts import uses), or a
 * repeat of an earlier row in the same sheet.
 */
export function rowStatuses(rows: ImportRow[], contacts: Contact[]): RowStatus[] {
  const byEmail = new Map<string, string>()
  const byPhone = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const c of contacts) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id)
    if (digits(c.phone).length >= 7) byPhone.set(digits(c.phone), c.id)
    byName.set(nameKey(c), c.id)
  }

  const seen = new Map<string, number>()
  return rows.map((row) => {
    const v = row.values
    if (!v.firstName?.trim()) return { kind: 'needs-name' }

    const existing =
      (v.email && byEmail.get(v.email.toLowerCase())) ||
      (digits(v.phone).length >= 7 ? byPhone.get(digits(v.phone)) : undefined) ||
      byName.get(nameKey(v))
    if (existing) return { kind: 'existing', contactId: existing }

    const keys = [
      v.email ? `e:${v.email.toLowerCase()}` : null,
      digits(v.phone).length >= 7 ? `p:${digits(v.phone)}` : null,
      `n:${nameKey(v)}`,
    ].filter((k): k is string => Boolean(k))
    const earlier = keys.map((k) => seen.get(k)).find((n) => n !== undefined)
    if (earlier !== undefined) return { kind: 'repeat', ofSheetRow: earlier }
    for (const k of keys) seen.set(k, row.sheetRow)

    return { kind: 'ready', warnings: warningsFor(v) }
  })
}

// --- Saving --------------------------------------------------------------

export interface CommitResult {
  added: number
  birthdays: number
  tagsCreated: number
}

/**
 * Save the chosen rows. Tags (from a Tags column, plus the optional batch
 * tag) are created first, so every contact arrives already tagged; birthdays
 * become key dates, as they do for the phone-contacts import.
 */
export async function commitRows(
  rows: ImportRow[],
  options: { knownTags: Tag[]; batchTag?: string },
): Promise<CommitResult> {
  const batch = options.batchTag?.trim()
  const pool = [...options.knownTags]
  const tagIdByName = new Map<string, string>()
  let tagsCreated = 0

  async function tagId(name: string): Promise<string | undefined> {
    const key = name.trim().toLowerCase()
    if (!key) return undefined
    const cached = tagIdByName.get(key)
    if (cached) return cached
    const { ids, created } = await ensureTags([name], pool)
    pool.push(...created)
    tagsCreated += created.length
    if (ids[0]) tagIdByName.set(key, ids[0])
    return ids[0]
  }

  const drafts: ContactDraft[] = []
  for (const { values: v } of rows) {
    const names = [...splitTags(v.tags ?? ''), ...(batch ? [batch] : [])]
    const tagIds: string[] = []
    for (const name of names) {
      const id = await tagId(name)
      if (id && !tagIds.includes(id)) tagIds.push(id)
    }
    const website = v.website?.trim()
    drafts.push({
      firstName: v.firstName!.trim(),
      lastName: v.lastName?.trim() ?? '',
      email: v.email && isEmail(v.email) ? v.email : undefined,
      phone: v.phone || undefined,
      company: v.company || undefined,
      jobTitle: v.jobTitle || undefined,
      industry: v.industry || undefined,
      linkedinUrl: v.linkedinUrl || undefined,
      twitter: v.twitter || undefined,
      otherLinks: website ? [{ id: createId(), label: 'Website', url: website }] : [],
      school: v.school || undefined,
      gradYear: v.gradYear || undefined,
      major: v.major || undefined,
      whereWeMet: v.whereWeMet || undefined,
      howWeMet: v.howWeMet || undefined,
      dateMet: (v.dateMet && parseDate(v.dateMet)) || undefined,
      lastContactDate: (v.lastContactDate && parseDate(v.lastContactDate)) || undefined,
      notes: v.notes || undefined,
      tagIds,
      relationshipStrength: 2,
      // No reconnect goal: a spreadsheet says nothing about how often you
      // mean to talk, and a default would put hundreds of people on the
      // overdue list the moment the import finishes.
      contactFrequencyGoal: 'none',
    })
  }

  const created = await contactRepo.createMany(drafts)

  const timestamp = new Date().toISOString()
  const keyDates: KeyDate[] = []
  rows.forEach(({ values }, i) => {
    const b = values.birthday ? parseBirthday(values.birthday) : null
    if (!b || !created[i]) return
    keyDates.push({
      id: createId(),
      contactId: created[i].id,
      label: 'Birthday',
      month: b.month,
      day: b.day,
      year: b.year,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  })
  if (keyDates.length) {
    try {
      await keyDateRepo.insertAll(keyDates)
    } catch (err) {
      // The people are in; a birthday that didn't save isn't a failed import.
      console.error('Could not save imported birthdays', err)
    }
  }

  return { added: created.length, birthdays: keyDates.length, tagsCreated }
}

/** The columns worth showing in the review table, in field order. */
export function visibleFields(mapping: ColumnMapping): RowField[] {
  const mapped = new Set(mapping.columns)
  const fields: RowField[] = ['firstName', 'lastName']
  for (const key of Object.keys(FIELD_BY_KEY) as ImportField[]) {
    if (key === 'firstName' || key === 'lastName' || key === 'fullName') continue
    if (mapped.has(key)) fields.push(key)
  }
  return fields
}
