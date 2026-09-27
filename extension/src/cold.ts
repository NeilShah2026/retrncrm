import { getUserId } from './db'
import { supabase } from './supabase'

/**
 * Cold email targets: people you've emailed but haven't met. They live in
 * their own table, not in contacts — the web app's Cold email page is where
 * they're worked on, and where one becomes a contact once they reply.
 *
 * ⚠️ `FOLLOW_UP_GAPS` and `nextFollowUpAfter` are a copy of the web app's
 * (src/lib/coldEmail.ts), since the extension can't import from it. A change
 * to the schedule belongs in both.
 */

/** Days before each follow-up, counted from the send before it. */
export const FOLLOW_UP_GAPS = [5, 7] as const

export interface ColdSend {
  id: string
  /** yyyy-mm-dd */
  date: string
  subject?: string
  body?: string
  link?: string
  createdAt: string
}

export interface ColdTarget {
  id: string
  first_name: string
  last_name: string
  email: string | null
  company: string | null
  role: string | null
  status: 'drafting' | 'sent' | 'replied' | 'converted' | 'closed'
  sends: ColdSend[]
  next_follow_up: string | null
}

const COLS = 'id, first_name, last_name, email, company, role, status, sends, next_follow_up'

export const coldName = (t: Pick<ColdTarget, 'first_name' | 'last_name' | 'email'>) =>
  `${t.first_name} ${t.last_name}`.trim() || t.email || 'them'

/** yyyy-mm-dd plus `days`, in local dates — no time zone can shift it a day. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

const byDate = (a: ColdSend, b: ColdSend) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)

export function nextFollowUpAfter(sends: ColdSend[]): string | null {
  if (sends.length === 0) return null
  const gap = FOLLOW_UP_GAPS[sends.length - 1]
  if (gap === undefined) return null
  const last = [...sends].sort(byDate)[sends.length - 1]
  return addDays(last.date, gap)
}

/** Whether this thread is already one of their sends. */
export function loggedSend(target: ColdTarget, threadKey: string): ColdSend | undefined {
  return target.sends.find((s) => s.link?.includes(threadKey))
}

/** "The free plan tracks 10…" when that's why a save failed. */
export function coldLimitMessage(err: unknown): string | null {
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.includes('FREE_COLD_TARGET_LIMIT')
    ? 'The free plan tracks 10 cold emails at a time. Make a contact of anyone who replied, close the ones you’re done with, or upgrade in Retrn.'
    : null
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '')
}

/** Escapes LIKE wildcards: `_` is common in addresses and would match anything. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`)
const orValue = (s: string) => `"${s.replace(/["\\]/g, (ch) => `\\${ch}`)}"`

/**
 * Targets with any of these addresses. Empty — not an error — before the
 * cold email migration has run, so contact logging never breaks over it.
 */
export async function findColdTargetsByEmails(emails: string[]): Promise<ColdTarget[]> {
  const wanted = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  if (wanted.length === 0) return []
  const { data, error } = await supabase
    .from('cold_targets')
    .select(COLS)
    .or(wanted.map((e) => `email.ilike.${orValue(likeLiteral(e))}`).join(','))
    .limit(50)
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return ((data as ColdTarget[] | null) ?? []).filter((t) => t.email && wanted.includes(t.email.toLowerCase()))
}

export interface SendInput {
  date: string
  subject?: string
  body?: string
  link?: string
}

function toSend(input: SendInput): ColdSend {
  return {
    id: crypto.randomUUID(),
    date: input.date,
    createdAt: new Date().toISOString(),
    ...(input.subject?.trim() ? { subject: input.subject.trim() } : {}),
    ...(input.body?.trim() ? { body: input.body.trim() } : {}),
    ...(input.link ? { link: input.link } : {}),
  }
}

export type ColdUndo = () => Promise<void>

/** Someone new, with their first email already sent. */
export async function createColdTarget(
  person: { name: string; email?: string; company?: string; role?: string },
  input: SendInput,
): Promise<{ target: ColdTarget; undo: ColdUndo }> {
  const user_id = await getUserId()
  const [first, ...rest] = person.name.trim().split(/\s+/)
  const sends = [toSend(input)]
  const { data, error } = await supabase
    .from('cold_targets')
    .insert({
      user_id,
      first_name: first ?? '',
      last_name: rest.join(' '),
      email: person.email?.trim().toLowerCase() || null,
      company: person.company?.trim() || null,
      role: person.role?.trim() || null,
      status: 'sent',
      sends,
      next_follow_up: nextFollowUpAfter(sends),
    })
    .select(COLS)
    .single()
  if (error) throw error
  const target = data as ColdTarget
  return {
    target,
    undo: async () => {
      const { error: undoError } = await supabase.from('cold_targets').delete().eq('id', target.id)
      if (undoError) throw undoError
    },
  }
}

/**
 * One more email to someone already on the list — a follow-up, usually.
 * Read fresh first so a change made on the web page in the meantime isn't
 * overwritten.
 */
export async function logColdSend(targetId: string, input: SendInput): Promise<{ target: ColdTarget; undo: ColdUndo }> {
  const { data: fresh, error: readError } = await supabase.from('cold_targets').select(COLS).eq('id', targetId).single()
  if (readError) throw readError
  const before = fresh as ColdTarget

  const sends = [...(before.sends ?? []), toSend(input)].sort(byDate)
  // A reply or a conversion outranks another send; anything else is "sent".
  const status = before.status === 'replied' || before.status === 'converted' ? before.status : 'sent'
  const { data, error } = await supabase
    .from('cold_targets')
    .update({ sends, status, next_follow_up: status === 'sent' ? nextFollowUpAfter(sends) : null })
    .eq('id', targetId)
    .select(COLS)
    .single()
  if (error) throw error
  return {
    target: data as ColdTarget,
    undo: async () => {
      const { error: undoError } = await supabase
        .from('cold_targets')
        .update({ sends: before.sends, status: before.status, next_follow_up: before.next_follow_up })
        .eq('id', targetId)
      if (undoError) throw undoError
    },
  }
}
