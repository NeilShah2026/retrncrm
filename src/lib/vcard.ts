import type { ShareProfile } from '@/lib/shareProfile'

/**
 * Turning a scanned profile into a contact in the phone's own address book.
 *
 * This is the one thing the scan page can give someone with no account, no
 * app and no sign-up: the person they just met, in their Contacts, in one
 * tap. `addressBook.ts` reads vCards (the import flow); this writes them.
 *
 * vCard 3.0 rather than 4.0 on purpose — it is what iOS Contacts, Google
 * Contacts and Outlook all accept without argument, and 4.0 buys us nothing
 * for the handful of fields a Retrn profile carries.
 */

/** Escape a value for a vCard field: backslash, comma, semicolon, newline. */
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n')
}

/**
 * vCard lines wrap at 75 octets, continuing with a leading space. Most
 * parsers cope without it, but a long LinkedIn URL in a NOTE is exactly the
 * case where the strict ones stop coping.
 */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`)
  return parts.join('\r\n')
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/** What the meeting is called in the saved card's note. */
export interface MeetingNote {
  /** Free text — "Babson startup fair". */
  where?: string
  /** ISO date (yyyy-mm-dd). */
  on?: string
}

/**
 * A .vcf for one scanned profile.
 *
 * The labelled URL rows (`item1.URL` + `item1.X-ABLabel`) are Apple's
 * extension, and the reason a saved contact says "LinkedIn" rather than
 * three unnamed links. Other clients ignore the label and keep the URL.
 */
export function profileToVCard(profile: ShareProfile, meeting?: MeetingNote): string {
  const [firstName, ...rest] = profile.name.trim().split(/\s+/)
  const lastName = rest.join(' ')

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']
  lines.push(`N:${esc(lastName)};${esc(firstName ?? '')};;;`)
  lines.push(`FN:${esc(profile.name.trim())}`)
  if (profile.company) lines.push(`ORG:${esc(profile.company)}`)
  if (profile.headline) lines.push(`TITLE:${esc(profile.headline)}`)
  if (profile.email) lines.push(`EMAIL;TYPE=INTERNET,PREF:${esc(profile.email)}`)
  if (profile.phone) lines.push(`TEL;TYPE=CELL:${esc(profile.phone)}`)

  let item = 0
  if (profile.website) lines.push(`URL:${esc(withScheme(profile.website))}`)
  if (profile.linkedinUrl) {
    item += 1
    lines.push(`item${item}.URL:${esc(withScheme(profile.linkedinUrl))}`)
    lines.push(`item${item}.X-ABLabel:LinkedIn`)
  }
  if (profile.twitter) {
    const handle = profile.twitter.replace(/^@/, '')
    item += 1
    lines.push(`item${item}.URL:${esc(`https://x.com/${handle}`)}`)
    lines.push(`item${item}.X-ABLabel:X`)
  }

  // The note is what makes this worth saving six months from now: not just a
  // name and a number, but where the two of you actually met.
  const note = [
    [profile.school, profile.gradYear && `’${profile.gradYear.slice(-2)}`]
      .filter(Boolean)
      .join(' '),
    profile.major,
    meeting?.where && `Met at ${meeting.where}`,
    meeting?.on && `Met ${formatDay(meeting.on)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  if (note) lines.push(`NOTE:${esc(note)}`)

  lines.push('END:VCARD')

  return `${lines.map(fold).join('\r\n')}\r\n`
}

/** `2026-09-19` -> `Sep 19, 2026`, without pulling in a date library. */
function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** `Neil Shah` -> `neil-shah.vcf`. */
function fileNameFor(name: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'contact'
  return `${base}.vcf`
}

/** How the card actually reached the address book, for the copy afterwards. */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Hand a vCard to the device.
 *
 * Two routes, in order of how little work they leave the person:
 *
 *  1. **The share sheet**, where the browser can share a file (iOS Safari,
 *     Android Chrome). The sheet offers Contacts directly, so the card is
 *     saved without ever becoming a file someone has to go and find.
 *  2. **A download**, everywhere else. On a desktop that opens in the
 *     contacts app; on a phone without file sharing it lands in Files and
 *     takes a tap to import — which is why it is second.
 *
 * A cancelled share sheet is reported as such rather than silently falling
 * through to a download: someone who dismissed the sheet did not ask for a
 * file in their downloads folder.
 */
export async function saveVCard(
  profile: ShareProfile,
  meeting?: MeetingNote,
): Promise<SaveOutcome> {
  const text = profileToVCard(profile, meeting)
  const fileName = fileNameFor(profile.name)

  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([text], fileName, { type: 'text/vcard' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
        return 'shared'
      }
    } catch (err) {
      // `AbortError` is the person dismissing the sheet. Anything else means
      // the sheet couldn't open at all, so the download is still worth trying.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  const blob = new Blob([text], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
