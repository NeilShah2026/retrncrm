import { supabase } from './supabase'

export interface Interaction {
  id: string
  date: string // yyyy-mm-dd
  type: string
  summary: string
  createdAt: string
  /** Deep link back to the source email thread / LinkedIn page. */
  link?: string
}

export interface ContactLite {
  id: string
  first_name: string
  last_name: string
  email: string | null
  linkedin_url: string | null
  company: string | null
  job_title: string | null
  interactions: Interaction[] | null
  last_contact_date: string | null
}

const COLS =
  'id, first_name, last_name, email, linkedin_url, company, job_title, interactions, last_contact_date'

export async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Not signed in.')
  return data.user.id
}

/** The signed-in user's own email, so we can exclude them from thread participants. */
export async function getMyEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? null
}

export async function findContactByEmail(email: string): Promise<ContactLite | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select(COLS)
    .ilike('email', email.trim())
    .limit(1)
  if (error) throw error
  return (data?.[0] as ContactLite | undefined) ?? null
}

/** Extract the `/in/<slug>` identity from any LinkedIn profile URL. */
export function linkedinSlug(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return m ? m[1].toLowerCase() : null
}

export async function findContactByLinkedin(url: string): Promise<ContactLite | null> {
  const slug = linkedinSlug(url)
  if (!slug) return null
  const { data, error } = await supabase
    .from('contacts')
    .select(COLS)
    .ilike('linkedin_url', `%/in/${slug}%`)
    .limit(1)
  if (error) throw error
  return (data?.[0] as ContactLite | undefined) ?? null
}

/** Fuzzy name match for "I already have this person but not their email." */
export async function findContactsByName(name: string): Promise<ContactLite[]> {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return []
  const first = parts[0]
  const last = parts.slice(1).join(' ')
  let q = supabase.from('contacts').select(COLS).ilike('first_name', first)
  if (last) q = q.ilike('last_name', `${last}%`)
  const { data, error } = await q.limit(5)
  if (error) throw error
  return (data as ContactLite[] | null) ?? []
}

function newInteraction(input: {
  type: string
  date: string
  summary: string
  link?: string
}): Interaction {
  return {
    id: crypto.randomUUID(),
    date: input.date,
    type: input.type,
    summary: input.summary,
    createdAt: new Date().toISOString(),
    ...(input.link ? { link: input.link } : {}),
  }
}

export interface ContactPatch {
  email?: string
  linkedin_url?: string
  company?: string
  job_title?: string
}

/** Only include fields the contact is currently missing (don't overwrite). */
function fillPatch(contact: ContactLite, incoming: ContactPatch): ContactPatch {
  const patch: ContactPatch = {}
  if (incoming.email && !contact.email) patch.email = incoming.email
  if (incoming.linkedin_url && !contact.linkedin_url)
    patch.linkedin_url = incoming.linkedin_url
  if (incoming.company && !contact.company) patch.company = incoming.company
  if (incoming.job_title && !contact.job_title) patch.job_title = incoming.job_title
  return patch
}

/** Append an interaction to an existing contact, filling any missing fields. */
export async function logToExisting(
  contact: ContactLite,
  input: { type: string; date: string; summary: string; link?: string },
  fill?: ContactPatch,
): Promise<void> {
  const entry = newInteraction(input)
  const interactions = [...(contact.interactions ?? []), entry]
  const latest = interactions.map((i) => i.date).sort().at(-1)
  const last_contact_date =
    latest && (!contact.last_contact_date || latest > contact.last_contact_date)
      ? latest
      : contact.last_contact_date

  const { error } = await supabase
    .from('contacts')
    .update({ interactions, last_contact_date, ...(fill ? fillPatch(contact, fill) : {}) })
    .eq('id', contact.id)
  if (error) throw error
}

/** Update fields on an existing contact (used for LinkedIn add/update). */
export async function updateContact(
  contact: ContactLite,
  patch: ContactPatch,
): Promise<void> {
  const p = fillPatch(contact, patch)
  if (Object.keys(p).length === 0) return
  const { error } = await supabase.from('contacts').update(p).eq('id', contact.id)
  if (error) throw error
}

export interface NewContactFields {
  name: string
  email?: string
  linkedinUrl?: string
  company?: string
  jobTitle?: string
}

/** Create a new contact, optionally with a first interaction. */
export async function createContact(
  fields: NewContactFields,
  interaction?: { type: string; date: string; summary: string; link?: string },
): Promise<void> {
  const userId = await getUserId()
  const [firstName, ...rest] = fields.name.trim().split(/\s+/)
  const entry = interaction ? newInteraction(interaction) : null

  const { error } = await supabase.from('contacts').insert({
    user_id: userId,
    first_name: firstName || fields.email || fields.name,
    last_name: rest.join(' '),
    email: fields.email ?? null,
    linkedin_url: fields.linkedinUrl ?? null,
    company: fields.company ?? null,
    job_title: fields.jobTitle ?? null,
    source: 'other',
    interactions: entry ? [entry] : [],
    last_contact_date: entry ? entry.date : null,
  })
  if (error) throw error
}
