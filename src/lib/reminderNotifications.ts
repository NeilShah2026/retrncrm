import { isNative } from '@/lib/platform'
import { fullName } from '@/lib/format'
import { nextOccurrence, yearsAt } from '@/lib/keyDates'
import { ROUTES } from '@/lib/routes'
import type { Contact, FollowUp, KeyDate } from '@/types'

/**
 * Follow-ups and key dates, delivered as iPhone notifications.
 *
 * Everything here is *local* notifications: the phone schedules them itself
 * from the data it already has, so there is no push server, no device token,
 * and nothing about a contact leaves the device to make a reminder happen.
 * The cost is that a reminder added on the web only reaches the phone once
 * the app has next opened and synced — which is when `syncReminders` runs.
 *
 * iOS keeps at most 64 pending local notifications per app, so only the
 * soonest `MAX_PENDING` are scheduled; the rest are picked up on a later sync
 * as the early ones fire.
 *
 * The plugin is imported dynamically so none of it ships in the web bundle.
 */

/** Morning, local time — early enough to act on, late enough not to wake anyone. */
export const REMINDER_HOUR = 9
/** Under iOS's 64, leaving room for anything else the app ever schedules. */
const MAX_PENDING = 60

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!isNative) return 'unsupported'
  try {
    const { display } = await (await plugin()).checkPermissions()
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unsupported'
  }
}

/**
 * Ask once, at the moment it's obviously useful — right after someone saves
 * their first follow-up or date — rather than on launch, when a permission
 * prompt reads as the app wanting something for nothing.
 */
export async function ensureReminderPermission(): Promise<ReminderPermission> {
  const current = await reminderPermission()
  if (current !== 'prompt') return current
  try {
    const { display } = await (await plugin()).requestPermissions()
    return display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

interface Planned {
  id: number
  at: Date
  title: string
  body: string
  route: string
}

/** A stable 31-bit id per reminder, so a reschedule replaces rather than duplicates. */
function notificationId(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // Positive, non-zero, and inside a signed 32-bit int (what iOS stores).
  return (hash >>> 1) || 1
}

function atReminderHour(date: Date): Date {
  const d = new Date(date)
  d.setHours(REMINDER_HOUR, 0, 0, 0)
  return d
}

/** What should be pending right now, soonest first. Pure — exported for testing. */
export function planReminders(
  followUps: FollowUp[],
  keyDates: KeyDate[],
  contacts: Contact[],
  now: Date = new Date(),
): Planned[] {
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const out: Planned[] = []

  for (const f of followUps) {
    if (f.completedAt) continue
    const contact = byId.get(f.contactId)
    if (!contact) continue
    const [y, m, d] = f.dueDate.split('-').map(Number)
    const at = atReminderHour(new Date(y, m - 1, d))
    // Already past 9am on the day (or overdue): the dashboard has it; a
    // notification for the past would fire the instant it's scheduled.
    if (at <= now) continue
    out.push({
      id: notificationId(`follow-up:${f.id}:${f.dueDate}`),
      at,
      title: `Follow up with ${fullName(contact)}`,
      body: f.note?.trim() || 'You said you’d get back to them today.',
      route: ROUTES.contact(contact.id),
    })
  }

  for (const k of keyDates) {
    const contact = byId.get(k.contactId)
    if (!contact) continue
    let occurrence = nextOccurrence(k, now)
    let at = atReminderHour(occurrence)
    if (at <= now) {
      // Today's has already gone by — schedule next year's.
      occurrence = nextOccurrence(k, new Date(occurrence.getFullYear() + 1, 0, 1))
      at = atReminderHour(occurrence)
    }
    const name = fullName(contact)
    const isBirthday = /birthday/i.test(k.label)
    const years = yearsAt(k, occurrence)
    out.push({
      id: notificationId(`key-date:${k.id}:${occurrence.getFullYear()}`),
      at,
      title: isBirthday ? `${name}’s birthday is today` : `${name}: ${k.label}`,
      body: isBirthday
        ? years
          ? `They turn ${years}. A quick message goes a long way.`
          : 'A quick message goes a long way.'
        : years
          ? `${years} ${years === 1 ? 'year' : 'years'} today.`
          : `${k.label} is today.`,
      route: ROUTES.contact(contact.id),
    })
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_PENDING)
}

/** The last set scheduled this session, so an unchanged sync costs nothing. */
let lastSignature = ''

/**
 * Make the phone's pending notifications match the data. Safe to call as
 * often as the data changes: it no-ops off native, without permission, or
 * when nothing that affects a notification has changed.
 */
export async function syncReminders(
  followUps: FollowUp[],
  keyDates: KeyDate[],
  contacts: Contact[],
): Promise<void> {
  if (!isNative) return
  if ((await reminderPermission()) !== 'granted') return

  const planned = planReminders(followUps, keyDates, contacts)
  const signature = planned.map((p) => `${p.id}@${p.at.getTime()}:${p.title}:${p.body}`).join('|')
  if (signature === lastSignature) return

  const LocalNotifications = await plugin()
  const { notifications: pending } = await LocalNotifications.getPending()
  if (pending.length) {
    await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
  }
  if (planned.length) {
    await LocalNotifications.schedule({
      notifications: planned.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: { route: p.route },
      })),
    })
  }
  lastSignature = signature
}

/** Sign-out: the next person on this phone must not get this account's reminders. */
export async function clearReminders(): Promise<void> {
  if (!isNative) return
  lastSignature = ''
  try {
    const LocalNotifications = await plugin()
    const { notifications: pending } = await LocalNotifications.getPending()
    if (pending.length) {
      await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
    }
  } catch (err) {
    console.error('Could not clear reminders', err)
  }
}

/**
 * Tapping a notification opens the person it's about. The plugin holds the
 * tap until a listener exists, so a tap that cold-launched the app still
 * lands here once the app shell mounts.
 */
export async function onReminderTapped(navigate: (route: string) => void): Promise<() => void> {
  if (!isNative) return () => {}
  const LocalNotifications = await plugin()
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const route = (action.notification.extra as { route?: unknown } | undefined)?.route
    if (typeof route === 'string' && route.startsWith('/')) navigate(route)
  })
  return () => void handle.remove()
}
