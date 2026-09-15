import { supabase } from './supabase'

/**
 * Reads and writes against the same `contacts` and `tags` tables as the web
 * app, scoped to the signed-in account by row-level security. Interactions
 * are appended exactly the way the web app's repository does it
 * (src/services/supabaseContactRepository.ts), so a contact logged from the
 * extension is indistinguishable from one logged in Retrn.
 */

export const INTERACTION_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'text', label: 'Text' },
  { value: 'event', label: 'Event' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
] as const

export interface Interaction {
  id: string
  date: string // yyyy-mm-dd
  type: string
  summary: string
  createdAt: string
  /** Deep link back to the email thread or LinkedIn page it came from. */
  link?: string
}

export interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  linkedin_url: string | null
  company: string | null
  job_title: string | null
  interactions: Interaction[] | null
  last_contact_date: string | null
  contact_frequency_goal: string | null
  tag_ids: string[] | null
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface InteractionInput {
  type: string
  date: string
  summary: string
  link?: string
}

const COLS =
  'id, first_name, last_name, email, linkedin_url, company, job_title, interactions, last_contact_date, contact_frequency_goal, tag_ids'

export const contactName = (c: Pick<Contact, 'first_name' | 'last_name'>) =>
  `${c.first_name} ${c.last_name}`.trim()

/** Escapes LIKE wildcards: `_` is common in addresses and would match anything. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`)

/** A value safe inside a PostgREST `or=(…)` list. */
const orValue = (s: string) => `"${s.replace(/["\\]/g, (ch) => `\\${ch}`)}"`

export async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('You’ve been signed out. Sign in again to save.')
  return id
}

/** Contacts whose email is any of these addresses, matched case-insensitively. */
export async function findContactsByEmails(emails: string[]): Promise<Contact[]> {
  const wanted = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  if (wanted.length === 0) return []
  const { data, error } = await supabase
    .from('contacts')
    .select(COLS)
    .or(wanted.map((e) => `email.ilike.${orValue(likeLiteral(e))}`).join(','))
    .limit(50)
  if (error) throw error
  return ((data as Contact[] | null) ?? []).filter((c) => c.email && wanted.includes(c.email.toLowerCase()))
}

/** The `/in/<slug>` identity from any LinkedIn profile URL. */
export function linkedinSlug(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return m ? decodeURIComponent(m[1]).toLowerCase() : null
}

export async function findContactByLinkedin(url: string): Promise<Contact | null> {
  const slug = linkedinSlug(url)
  if (!slug) return null
  const { data, error } = await supabase
    .from('contacts')
    .select(COLS)
    .ilike('linkedin_url', `%/in/${likeLiteral(slug)}%`)
    .limit(1)
  if (error) throw error
  return (data?.[0] as Contact | undefined) ?? null
}

/** People with this name — for "I have them, just not their email yet". */
export async function findContactsByName(name: string): Promise<Contact[]> {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return []
  let q = supabase.from('contacts').select(COLS).ilike('first_name', likeLiteral(parts[0]))
  if (parts.length > 1) q = q.ilike('last_name', `${likeLiteral(parts.slice(1).join(' '))}%`)
  const { data, error } = await q.limit(5)
  if (error) throw error
  return (data as Contact[] | null) ?? []
}

/** Name, company or email containing the query; most recently in touch first. */
export async function searchContacts(query: string): Promise<Contact[]> {
  const q = query.trim()
  let request = supabase.from('contacts').select(COLS)
  if (q) {
    const words = q.split(/\s+/).filter(Boolean)
    // Every word has to hit some field, so "priya klav" still finds Priya at Klaviyo.
    for (const word of words) {
      const v = orValue(`%${likeLiteral(word)}%`)
      request = request.or(
        `first_name.ilike.${v},last_name.ilike.${v},company.ilike.${v},email.ilike.${v}`,
      )
    }
  }
  const { data, error } = await request
    .order('last_contact_date', { ascending: false, nullsFirst: false })
    .limit(q ? 20 : 6)
  if (error) throw error
  return (data as Contact[] | null) ?? []
}

export async function getTags(ids: string[]): Promise<Tag[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('tags').select('id, name, color').in('id', ids)
  if (error) throw error
  return (data as Tag[] | null) ?? []
}

/** The interaction already logged for this thread, if any. */
export function loggedEntry(contact: Contact, threadKey: string): Interaction | undefined {
  if (!threadKey) return undefined
  return (contact.interactions ?? []).find((i) => i.link?.includes(threadKey))
}

const latestDate = (items: Interaction[]) =>
  items
    .map((i) => i.date)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null

/** What an undo needs to put a contact back exactly as it was. */
export type UndoToken =
  | { kind: 'appended'; contactId: string; entryId: string; previousLastContact: string | null; filled: string[] }
  | { kind: 'created'; contactId: string }

export interface ContactFill {
  email?: string
  linkedin_url?: string
  company?: string
  job_title?: string
}

/** Only the fields the contact doesn't have yet. Nothing already written is overwritten. */
function missingFields(contact: Contact, incoming: ContactFill): ContactFill {
  const patch: ContactFill = {}
  for (const key of ['email', 'linkedin_url', 'company', 'job_title'] as const) {
    const value = incoming[key]?.trim()
    if (value && !contact[key]) patch[key] = value
  }
  return patch
}

/**
 * Appends an interaction, filling in details the contact is missing (an email
 * address, a LinkedIn URL). Re-reads the contact first so an interaction logged
 * elsewhere in the meantime isn't overwritten.
 */
export async function logInteraction(
  contactId: string,
  input: InteractionInput,
  fill: ContactFill = {},
): Promise<{ contact: Contact; undo: UndoToken }> {
  const { data: fresh, error: readError } = await supabase
    .from('contacts')
    .select(COLS)
    .eq('id', contactId)
    .single()
  if (readError) throw readError
  const contact = fresh as Contact

  const entry: Interaction = {
    id: crypto.randomUUID(),
    date: input.date,
    type: input.type,
    summary: input.summary,
    createdAt: new Date().toISOString(),
    ...(input.link ? { link: input.link } : {}),
  }
  const interactions = [...(contact.interactions ?? []), entry]
  const latest = latestDate(interactions)
  const last_contact_date =
    latest && (!contact.last_contact_date || latest > contact.last_contact_date)
      ? latest
      : contact.last_contact_date
  const patch = missingFields(contact, fill)

  const { data, error } = await supabase
    .from('contacts')
    .update({ interactions, last_contact_date, ...patch })
    .eq('id', contact.id)
    .select(COLS)
    .single()
  if (error) throw error
  return {
    contact: data as Contact,
    undo: {
      kind: 'appended',
      contactId: contact.id,
      entryId: entry.id,
      previousLastContact: contact.last_contact_date,
      filled: Object.keys(patch),
    },
  }
}

export interface NewContact {
  name: string
  email?: string
  linkedinUrl?: string
  company?: string
  jobTitle?: string
}

export async function createContact(
  fields: NewContact,
  interaction?: InteractionInput,
): Promise<{ contact: Contact; undo: UndoToken }> {
  const userId = await getUserId()
  const [firstName, ...rest] = fields.name.trim().split(/\s+/)
  const entry: Interaction | null = interaction
    ? {
        id: crypto.randomUUID(),
        date: interaction.date,
        type: interaction.type,
        summary: interaction.summary,
        createdAt: new Date().toISOString(),
        ...(interaction.link ? { link: interaction.link } : {}),
      }
    : null

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      first_name: firstName || fields.email || 'Unnamed',
      last_name: rest.join(' '),
      email: fields.email?.trim() || null,
      linkedin_url: fields.linkedinUrl || null,
      company: fields.company?.trim() || null,
      job_title: fields.jobTitle?.trim() || null,
      interactions: entry ? [entry] : [],
      last_contact_date: entry?.date ?? null,
      date_met: entry?.date ?? null,
    })
    .select(COLS)
    .single()
  if (error) throw error
  const contact = data as Contact
  return { contact, undo: { kind: 'created', contactId: contact.id } }
}

/** Updates details from a LinkedIn profile, again only where the contact has none. */
export async function fillContact(contactId: string, fill: ContactFill): Promise<Contact> {
  const { data: fresh, error: readError } = await supabase
    .from('contacts')
    .select(COLS)
    .eq('id', contactId)
    .single()
  if (readError) throw readError
  const patch = missingFields(fresh as Contact, fill)
  if (Object.keys(patch).length === 0) return fresh as Contact
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', contactId)
    .select(COLS)
    .single()
  if (error) throw error
  return data as Contact
}

/** Reverses a log or a create. */
export async function undo(token: UndoToken): Promise<void> {
  if (token.kind === 'created') {
    const { error } = await supabase.from('contacts').delete().eq('id', token.contactId)
    if (error) throw error
    return
  }
  const { data: fresh, error: readError } = await supabase
    .from('contacts')
    .select(COLS)
    .eq('id', token.contactId)
    .single()
  if (readError) throw readError
  const contact = fresh as Contact
  const interactions = (contact.interactions ?? []).filter((i) => i.id !== token.entryId)
  const reverted: Record<string, unknown> = {
    interactions,
    last_contact_date: token.previousLastContact,
  }
  for (const key of token.filled) reverted[key] = null
  const { error } = await supabase.from('contacts').update(reverted).eq('id', contact.id)
  if (error) throw error
}
