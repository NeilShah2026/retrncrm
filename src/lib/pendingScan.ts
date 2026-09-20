import { toast } from 'sonner'
import { contactRepo, followUpRepo } from '@/services'
import { track } from '@/lib/analytics'
import { profileToContactDraft, type ShareProfile } from '@/lib/shareProfile'
import { isContactLimitError } from '@/lib/billing/contactLimit'

/**
 * A scan that is waiting for an account.
 *
 * Someone scans a card, saves the contact to their phone, and then asks for
 * a reminder to follow up — which is the moment they sign up. Signing up
 * sends a confirmation email, so there is no session to write anything with
 * until they come back through that link, which might be ten minutes later.
 *
 * Rather than lose the person they just met, the scan is kept here until a
 * session exists. `AuthProvider` applies it on the next sign-in, so the
 * contact and the follow-up are simply there when they arrive.
 *
 * It lives in `localStorage` and nowhere else: the details are someone's
 * name and number, held on their own device, for as long as it takes to
 * confirm an email.
 */

const KEY = 'retrn.pending-scan'

/** Long enough to confirm an email; short enough not to be a surprise. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface PendingScan {
  profile: ShareProfile
  /** Free text — "Babson startup fair". */
  whereWeMet?: string
  /** ISO date (yyyy-mm-dd) they met. */
  metOn: string
  /** Days from the meeting to the follow-up; absent means no reminder. */
  remindInDays?: number
  /** The published card it came from, if it had one. */
  slug?: string
  stashedAt: number
}

export function stashPendingScan(scan: Omit<PendingScan, 'stashedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...scan, stashedAt: Date.now() }))
  } catch {
    // Private mode, or a full quota. The signup still works; the contact just
    // has to be added by hand.
  }
}

export function readPendingScan(): PendingScan | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const scan = JSON.parse(raw) as PendingScan
    if (!scan?.profile?.name || Date.now() - scan.stashedAt > TTL_MS) {
      clearPendingScan()
      return null
    }
    return scan
  } catch {
    return null
  }
}

export function clearPendingScan(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do; a stale entry expires on its own.
  }
}

/** `2026-09-19` + 3 days -> `2026-09-22`. */
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Turn a stashed scan into a real contact, with its follow-up.
 *
 * Safe to call on every sign-in: it does nothing without a stash, and it
 * clears the stash whether or not the write succeeded — a contact that
 * couldn't be saved twice is better than one that reappears at every sign-in.
 * Duplicates are checked first, because the obvious way to end up here twice
 * is scanning the same person's code at two different events.
 */
export async function applyPendingScan(): Promise<void> {
  const scan = readPendingScan()
  if (!scan) return
  clearPendingScan()

  try {
    const [firstName, ...rest] = scan.profile.name.trim().split(/\s+/)
    const lastName = rest.join(' ')
    const dupes = await contactRepo.findDuplicates(
      firstName ?? scan.profile.name,
      lastName,
      scan.profile.company,
    )
    if (dupes.length > 0) return

    const contact = await contactRepo.create({
      ...profileToContactDraft(scan.profile),
      howWeMet: 'Scanned their Retrn card',
      whereWeMet: scan.whereWeMet || undefined,
      dateMet: scan.metOn,
    })

    if (scan.remindInDays != null) {
      await followUpRepo.create({
        contactId: contact.id,
        dueDate: addDays(scan.metOn, scan.remindInDays),
        note: `Follow up with ${firstName ?? scan.profile.name}`,
      })
    }

    track('card_signup_completed', { reminded: scan.remindInDays != null })
    toast.success(`${scan.profile.name} is in your network`)
  } catch (err) {
    // The upgrade prompt is already up; a second error would just be noise.
    if (isContactLimitError(err)) return
    console.error('[pendingScan]', err)
  }
}
