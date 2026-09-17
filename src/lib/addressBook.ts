import { contactRepo, keyDateRepo, type ContactDraft } from '@/services'
import { isNative } from '@/lib/platform'
import { createId } from '@/lib/utils'
import { daysInMonth } from '@/lib/keyDates'
import type { Contact, KeyDate, OtherLink } from '@/types'

/**
 * Bringing people in from an address book: the iPhone's own Contacts on
 * native, or a .vcf file (what iCloud, Google Contacts and Outlook all
 * export) on the web.
 *
 * Nothing is uploaded until someone picks who to import. The whole address
 * book is read on the device, shown as a list, and only the chosen people —
 * with their birthdays, which become key dates — are saved to Retrn.
 */

export interface ImportCandidate {
  /** Stable within one read, for selection. */
  key: string
  firstName: string
  lastName: string
  company?: string
  jobTitle?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  otherLinks: OtherLink[]
  birthday?: Pick<KeyDate, 'month' | 'day' | 'year'>
  /** Set when someone already in Retrn looks like this person. */
  existingId?: string
}

export class AddressBookError extends Error {
  readonly reason: 'denied' | 'unsupported' | 'empty' | 'failed'
  constructor(message: string, reason: AddressBookError['reason']) {
    super(message)
    this.name = 'AddressBookError'
    this.reason = reason
  }
}

export const canReadPhoneContacts = isNative

// ---------------------------------------------------------------------------
// iPhone Contacts
// ---------------------------------------------------------------------------

export async function readPhoneContacts(): Promise<ImportCandidate[]> {
  if (!isNative) throw new AddressBookError('Only available in the iPhone app.', 'unsupported')
  const { Contacts } = await import('@capacitor-community/contacts')

  let permission = (await Contacts.checkPermissions()).contacts
  if (permission === 'prompt' || permission === 'prompt-with-rationale') {
    permission = (await Contacts.requestPermissions()).contacts
  }
  if (permission !== 'granted' && permission !== 'limited') {
    throw new AddressBookError(
      'Retrn doesn’t have access to your contacts. Turn it on in Settings → Retrn → Contacts.',
      'denied',
    )
  }

  let result
  try {
    result = await Contacts.getContacts({
      projection: {
        name: true,
        organization: true,
        birthday: true,
        phones: true,
        emails: true,
        urls: true,
      },
    })
  } catch (err) {
    console.error(err)
    throw new AddressBookError('Couldn’t read your contacts.', 'failed')
  }

  const out: ImportCandidate[] = []
  for (const c of result.contacts) {
    const given = clean(c.name?.given)
    const family = clean(c.name?.family)
    const company = clean(c.organization?.company)
    // A contact that's only a company ("Pizza Place") is still worth listing.
    const firstName = given ?? (family ? undefined : company) ?? clean(c.name?.display)
    if (!firstName && !family) continue

    const phones = c.phones ?? []
    const phone =
      phones.find((p) => p.type === 'mobile')?.number ??
      phones.find((p) => p.isPrimary)?.number ??
      phones[0]?.number
    const email = (c.emails ?? []).find((e) => e.isPrimary)?.address ?? c.emails?.[0]?.address
    const links = (c.urls ?? []).map(clean).filter((u): u is string => Boolean(u))

    out.push({
      key: c.contactId,
      firstName: firstName ?? family ?? '',
      lastName: firstName ? (family ?? '') : '',
      company: given || family ? company : undefined,
      jobTitle: clean(c.organization?.jobTitle),
      email: clean(email)?.toLowerCase(),
      phone: clean(phone),
      ...splitLinks(links),
      birthday: birthdayFrom(c.birthday?.month, c.birthday?.day, c.birthday?.year),
    })
  }
  return sortCandidates(out)
}

// ---------------------------------------------------------------------------
// vCard (.vcf)
// ---------------------------------------------------------------------------

/** Every card in a .vcf file. Tolerant of vCard 2.1, 3.0 and 4.0 as exported in the wild. */
export function parseVCards(text: string): ImportCandidate[] {
  // Unfold: a line starting with a space or tab continues the previous one.
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const out: ImportCandidate[] = []
  let card: Map<string, { params: string; value: string }[]> | null = null

  for (const line of lines) {
    if (/^BEGIN:VCARD/i.test(line)) {
      card = new Map()
      continue
    }
    if (/^END:VCARD/i.test(line)) {
      if (card) {
        const candidate = fromVCard(card, out.length)
        if (candidate) out.push(candidate)
      }
      card = null
      continue
    }
    if (!card) continue
    const colon = indexOfUnquoted(line, ':')
    if (colon < 0) continue
    const head = line.slice(0, colon)
    // "item1.EMAIL;type=INTERNET" → EMAIL + params
    const [nameWithGroup, ...params] = head.split(';')
    const name = nameWithGroup.replace(/^[^.]*\./, '').toUpperCase()
    const paramText = params.join(';')
    let value = line.slice(colon + 1)
    if (/ENCODING=QUOTED-PRINTABLE/i.test(paramText)) value = decodeQuotedPrintable(value)
    const list = card.get(name) ?? []
    list.push({ params: paramText.toUpperCase(), value })
    card.set(name, list)
  }
  return sortCandidates(out)
}

function fromVCard(
  card: Map<string, { params: string; value: string }[]>,
  index: number,
): ImportCandidate | null {
  const first = (name: string) => card.get(name)?.[0]
  const [family, given] = splitEscaped(first('N')?.value ?? '', ';').map(unescapeValue)
  const full = unescapeValue(first('FN')?.value ?? '')
  const [org] = splitEscaped(first('ORG')?.value ?? '', ';').map(unescapeValue)

  let firstName = clean(given)
  let lastName = clean(family) ?? ''
  if (!firstName && full) {
    const [f, ...rest] = full.split(/\s+/)
    firstName = f
    lastName = lastName || rest.join(' ')
  }
  if (!firstName) {
    if (!clean(org)) return null
    firstName = clean(org)!
  }

  const tels = card.get('TEL') ?? []
  const phone = (tels.find((t) => /CELL|MOBILE|IPHONE/.test(t.params)) ?? tels.find((t) => /PREF/.test(t.params)) ?? tels[0])?.value
  const emails = card.get('EMAIL') ?? []
  const email = (emails.find((e) => /PREF/.test(e.params)) ?? emails[0])?.value

  const links = [
    ...(card.get('URL') ?? []).map((u) => unescapeValue(u.value)),
    ...(card.get('X-SOCIALPROFILE') ?? []).map((u) => unescapeValue(u.value)),
  ]
    .map(clean)
    .filter((u): u is string => Boolean(u) && /^(https?:\/\/|www\.|[\w-]+\.[a-z]{2,})/i.test(u!))

  return {
    key: `vcf-${index}`,
    firstName,
    lastName,
    company: clean(org) && firstName !== clean(org) ? clean(org) : undefined,
    jobTitle: clean(unescapeValue(first('TITLE')?.value ?? '')),
    email: clean(email)?.toLowerCase(),
    phone: clean(phone?.replace(/^tel:/i, '')),
    ...splitLinks(links),
    birthday: parseVCardDate(first('BDAY')?.value),
  }
}

/** BDAY as vCards write it: 1999-03-14, 19990314, --0314, --03-14, or Apple's 1604-03-14 for "no year". */
function parseVCardDate(value?: string): ImportCandidate['birthday'] {
  if (!value) return undefined
  const v = value.trim().replace(/T.*$/, '')
  const full = v.match(/^(\d{4})-?(\d{2})-?(\d{2})$/)
  if (full) {
    const year = Number(full[1])
    return birthdayFrom(Number(full[2]), Number(full[3]), year === 1604 ? undefined : year)
  }
  const noYear = v.match(/^--(\d{2})-?(\d{2})$/)
  if (noYear) return birthdayFrom(Number(noYear[1]), Number(noYear[2]))
  return undefined
}

function indexOfUnquoted(s: string, ch: string): number {
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') quoted = !quoted
    else if (s[i] === ch && !quoted) return i
  }
  return -1
}

function splitEscaped(s: string, sep: string): string[] {
  const out: string[] = []
  let current = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      current += s[i] + s[i + 1]
      i++
    } else if (s[i] === sep) {
      out.push(current)
      current = ''
    } else current += s[i]
  }
  out.push(current)
  return out
}

function unescapeValue(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1')
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = []
  const text = s.replace(/=\n/g, '')
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-F]{2}$/i.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16))
      i += 2
    } else bytes.push(text.charCodeAt(i))
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  } catch {
    return text
  }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function clean(value: string | null | undefined): string | undefined {
  const s = value?.replace(/\s+/g, ' ').trim()
  return s ? s : undefined
}

function birthdayFrom(
  month?: number | null,
  day?: number | null,
  year?: number | null,
): ImportCandidate['birthday'] {
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return undefined
  const y = year && year >= 1900 && year <= new Date().getFullYear() ? year : undefined
  return { month, day, year: y }
}

function splitLinks(urls: string[]): Pick<ImportCandidate, 'linkedinUrl' | 'otherLinks'> {
  let linkedinUrl: string | undefined
  const otherLinks: OtherLink[] = []
  for (const raw of urls) {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    if (!linkedinUrl && /linkedin\.com\//i.test(url)) linkedinUrl = url
    else if (otherLinks.length < 3) otherLinks.push({ id: createId(), label: 'Website', url })
  }
  return { linkedinUrl, otherLinks }
}

function sortCandidates(list: ImportCandidate[]): ImportCandidate[] {
  return list.sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, undefined, {
      sensitivity: 'base',
    }),
  )
}

const digits = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-10)

/** Flag anyone who's already in Retrn — same email, same phone, or same full name. */
export function markExisting(candidates: ImportCandidate[], contacts: Contact[]): ImportCandidate[] {
  const byEmail = new Map<string, string>()
  const byPhone = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const c of contacts) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id)
    if (digits(c.phone).length >= 7) byPhone.set(digits(c.phone), c.id)
    byName.set(`${c.firstName} ${c.lastName}`.trim().toLowerCase(), c.id)
  }
  return candidates.map((cand) => ({
    ...cand,
    existingId:
      (cand.email && byEmail.get(cand.email)) ||
      (digits(cand.phone).length >= 7 ? byPhone.get(digits(cand.phone)) : undefined) ||
      byName.get(`${cand.firstName} ${cand.lastName}`.trim().toLowerCase()),
  }))
}

/** Save the chosen people, and their birthdays as key dates. Returns how many were added. */
export async function importCandidates(selected: ImportCandidate[]): Promise<number> {
  const drafts: ContactDraft[] = selected.map((c) => ({
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    jobTitle: c.jobTitle,
    email: c.email,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    otherLinks: c.otherLinks,
    tagIds: [],
    relationshipStrength: 2,
    // No cadence, and no "met" or "last contact" date: an address book says
    // nothing about when you last spoke, and inventing one would put hundreds
    // of people on the overdue list at once.
    contactFrequencyGoal: 'none',
  }))
  const created = await contactRepo.createMany(drafts)

  const timestamp = new Date().toISOString()
  const keyDates: KeyDate[] = []
  selected.forEach((c, i) => {
    if (!c.birthday) return
    keyDates.push({
      id: createId(),
      contactId: created[i].id,
      label: 'Birthday',
      ...c.birthday,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  })
  if (keyDates.length) {
    try {
      await keyDateRepo.insertAll(keyDates)
    } catch (err) {
      // The people are in; a missing birthday table (migration not run yet)
      // shouldn't turn that into a failed import.
      console.error('Could not save imported birthdays', err)
    }
  }
  return created.length
}
