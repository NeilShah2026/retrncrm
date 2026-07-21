import { createClient } from '@supabase/supabase-js'

/**
 * Public, read-only iCal feed: /api/calendar?token=<uuid>
 *
 * Calendar apps (Google, Apple, Outlook) poll this URL, so it has to be
 * reachable without a login. Access is gated by an unguessable per-user token
 * stored in `calendar_tokens` — deleting that row revokes the feed instantly.
 *
 * Runs on the edge and uses the SERVICE ROLE key (server-only env var) to read
 * the owning user's events past RLS. That key must never be exposed client-side.
 */
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

interface EventRow {
  id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  updated_at: string
}

/** Escape text per RFC 5545. */
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold lines to 75 octets, as the spec requires. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '')
const dateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10).replace(/-/g, '')

function buildIcs(events: EventRow[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Retrn//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Retrn',
    'NAME:Retrn',
    // Ask subscribers to re-poll hourly.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@retrncrm.com`)
    lines.push(`DTSTAMP:${utc(e.updated_at)}`)
    if (e.all_day) {
      // All-day events use DATE values, with an exclusive end date.
      const end = new Date(e.ends_at)
      end.setUTCDate(end.getUTCDate() + 1)
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.starts_at)}`)
      lines.push(`DTEND;VALUE=DATE:${dateOnly(end.toISOString())}`)
    } else {
      lines.push(`DTSTART:${utc(e.starts_at)}`)
      lines.push(`DTEND:${utc(e.ends_at)}`)
    }
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export default async function handler(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return new Response('Missing token', { status: 400 })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response('Calendar feed is not configured', { status: 500 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: tokenRow } = await admin
    .from('calendar_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()

  if (!tokenRow) return new Response('Calendar not found', { status: 404 })

  const { data: events, error } = await admin
    .from('events')
    .select('id, title, description, location, starts_at, ends_at, all_day, updated_at')
    .eq('user_id', (tokenRow as { user_id: string }).user_id)
    .order('starts_at', { ascending: true })

  if (error) return new Response('Could not load calendar', { status: 500 })

  return new Response(buildIcs((events ?? []) as EventRow[]), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="retrn.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
