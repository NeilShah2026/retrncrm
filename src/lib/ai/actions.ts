import { addMinutes, format, isValid, parseISO } from 'date-fns'
import { contactRepo, eventRepo, opportunityRepo } from '@/services'
import { ensureTags } from '@/lib/tagging'
import {
  CONNECTION_TYPE_KEYS,
  FREQUENCY_KEYS,
  FREQUENCY_OPTIONS,
  MEET_SOURCE_KEYS,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_KEYS,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_TYPE_KEYS,
} from '@/lib/constants'
import { formatDate, fullName, todayISO } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type {
  ConnectionType,
  Contact,
  ContactFrequency,
  MeetSource,
  OpportunityStage,
  OpportunityType,
  Tag,
} from '@/types'

/**
 * Telling the app to do something, instead of finding the form that does it.
 *
 * "met Priya at the AI meetup, she's a PM at Klaviyo — coffee with her next
 * Tuesday at 3" is four taps through three screens, or one sentence. The model
 * turns that sentence into a *plan*: a small list of typed, validated actions.
 * This module owns three things and nothing else:
 *
 * 1. `parseActions` — the plan the model returned, dragged through a strict
 *    validator. Unknown action types, bad enums, unparseable dates and
 *    oversized strings are dropped here, not somewhere deep in a repository.
 * 2. `describeAction` — what each action will do, in the user's words. This is
 *    what they approve, so it has to be honest and specific.
 * 3. `applyActions` — the executor, which is the only thing that writes.
 *
 * The rule the whole design rests on: **the model never writes.** It proposes;
 * the user confirms the plan; only then does anything touch a repository. And
 * every action is additive — nothing here deletes a contact, an event, or a
 * tag, so the worst a wrong plan can do is leave something to tidy up.
 */

/** A plan bigger than this is a misunderstanding, not a request. */
const MAX_ACTIONS = 8

const MAX_SHORT = 80
const MAX_LONG = 600

/** Meetings default to a coffee-length slot when no end is given. */
const DEFAULT_MEETING_MINUTES = 30

export interface AddContactAction {
  type: 'add_contact'
  firstName: string
  lastName?: string
  company?: string
  jobTitle?: string
  school?: string
  connectionType?: ConnectionType
  source?: MeetSource
  whereWeMet?: string
  howWeMet?: string
  email?: string
  phone?: string
  notes?: string
  tagNames?: string[]
}

export interface ScheduleMeetingAction {
  type: 'schedule_meeting'
  title: string
  /** Local wall-clock, `yyyy-MM-dd'T'HH:mm` — resolved from today by the model. */
  startsAtLocal: string
  durationMinutes: number
  allDay: boolean
  location?: string
  /** Names of people the meeting is with. Resolved against contacts at apply. */
  people: string[]
}

export interface LogCaughtUpAction {
  type: 'log_caught_up'
  person: string
  /** ISO date; defaults to today. */
  date?: string
}

export interface AddNoteAction {
  type: 'add_note'
  person: string
  text: string
}

export interface AddTagsAction {
  type: 'add_tags'
  person: string
  tagNames: string[]
}

export interface SetFollowUpAction {
  type: 'set_followup'
  person: string
  frequency: ContactFrequency
}

export interface AddOpportunityAction {
  type: 'add_opportunity'
  company: string
  role: string
  opportunityType: OpportunityType
  stage: OpportunityStage
  /** ISO date */
  deadline?: string
  people: string[]
}

export type AssistantAction =
  | AddContactAction
  | ScheduleMeetingAction
  | LogCaughtUpAction
  | AddNoteAction
  | AddTagsAction
  | SetFollowUpAction
  | AddOpportunityAction

// ---------------------------------------------------------------------------
// Parsing — everything the model says is untrusted until it gets through here
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>

function str(value: unknown, max = MAX_SHORT): string | undefined {
  if (typeof value !== 'string') return undefined
  const s = value.replace(/\s+/g, ' ').trim()
  if (!s || s.length > max) return undefined
  if (/^(null|none|n\/a|unknown|undefined)$/i.test(s)) return undefined
  return s
}

function enumOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim().toLowerCase().replace(/\s+/g, '-') as T
  return allowed.includes(v) ? v : undefined
}

/** A list of names, cleaned and de-duplicated — "Product, Product" reads as a bug. */
function names(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const entry of value) {
    const name = str(entry)
    if (!name) continue
    if (out.some((n) => n.toLowerCase() === name.toLowerCase())) continue
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

/** `yyyy-MM-dd`, and only if it's a real date within a sane window. */
function isoDate(value: unknown): string | undefined {
  const s = str(value, 10)
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  return plausible(parseISO(s)) ? s : undefined
}

/** `yyyy-MM-ddTHH:mm` local wall-clock — what the model is asked to produce. */
function localDateTime(value: unknown): string | undefined {
  const s = str(value, 19)
  if (!s) return undefined
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) {
    // A bare date is still usable — it becomes an all-day entry.
    const date = isoDate(s)
    return date ? `${date}T00:00` : undefined
  }
  const [, date, hh, mm] = match
  if (Number(hh) > 23 || Number(mm) > 59) return undefined
  const composed = `${date}T${hh}:${mm}`
  return plausible(new Date(composed)) ? composed : undefined
}

/** Guards against a model that answered "0202-09-04" or the year 9999. */
function plausible(date: Date): boolean {
  if (!isValid(date)) return false
  const year = date.getFullYear()
  const now = new Date().getFullYear()
  return year >= now - 5 && year <= now + 5
}

function parseAction(raw: Raw): AssistantAction | null {
  switch (str(raw.type, 40)?.toLowerCase().replace(/[\s-]+/g, '_')) {
    case 'add_contact': {
      const firstName = str(raw.firstName ?? raw.name)
      if (!firstName) return null
      // "Sarah Chen" in a single field is common enough to be worth splitting.
      const [first, ...rest] = firstName.split(' ')
      return {
        type: 'add_contact',
        firstName: first,
        lastName: str(raw.lastName) ?? (rest.length ? rest.join(' ') : undefined),
        company: str(raw.company),
        jobTitle: str(raw.jobTitle),
        school: str(raw.school),
        connectionType: enumOf(raw.connectionType, CONNECTION_TYPE_KEYS),
        source: enumOf(raw.source, MEET_SOURCE_KEYS),
        whereWeMet: str(raw.whereWeMet),
        howWeMet: str(raw.howWeMet, 200),
        email: str(raw.email),
        phone: str(raw.phone),
        notes: str(raw.notes, MAX_LONG),
        tagNames: names(raw.tagNames, 4),
      }
    }

    case 'schedule_meeting':
    case 'add_meeting':
    case 'add_event': {
      const title = str(raw.title, 120)
      const startsAtLocal = localDateTime(raw.startsAtLocal ?? raw.startsAt ?? raw.start)
      if (!title || !startsAtLocal) return null
      const minutes = Number(raw.durationMinutes)
      return {
        type: 'schedule_meeting',
        title,
        startsAtLocal,
        durationMinutes:
          Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440
            ? Math.round(minutes)
            : DEFAULT_MEETING_MINUTES,
        allDay: raw.allDay === true,
        location: str(raw.location, 120),
        people: names(raw.people),
      }
    }

    case 'log_caught_up':
    case 'caught_up': {
      const person = str(raw.person)
      if (!person) return null
      return { type: 'log_caught_up', person, date: isoDate(raw.date) }
    }

    case 'add_note': {
      const person = str(raw.person)
      const text = str(raw.text ?? raw.note, MAX_LONG)
      if (!person || !text) return null
      return { type: 'add_note', person, text }
    }

    case 'add_tags':
    case 'tag_contact': {
      const person = str(raw.person)
      const tagNames = names(raw.tagNames ?? raw.tags, 4)
      if (!person || !tagNames.length) return null
      return { type: 'add_tags', person, tagNames }
    }

    case 'set_followup':
    case 'set_follow_up': {
      const person = str(raw.person)
      const frequency = enumOf(raw.frequency, FREQUENCY_KEYS)
      if (!person || !frequency) return null
      return { type: 'set_followup', person, frequency }
    }

    case 'add_opportunity':
    case 'add_application': {
      const company = str(raw.company)
      const role = str(raw.role)
      if (!company || !role) return null
      return {
        type: 'add_opportunity',
        company,
        role,
        opportunityType:
          enumOf(raw.opportunityType ?? raw.opportunity_type, OPPORTUNITY_TYPE_KEYS) ??
          'internship',
        stage: enumOf(raw.stage, OPPORTUNITY_STAGE_KEYS) ?? 'researching',
        deadline: isoDate(raw.deadline),
        people: names(raw.people),
      }
    }

    default:
      return null
  }
}

/** The `actions` array from a model reply, validated down to what we'll run. */
export function parseActions(value: unknown): AssistantAction[] {
  if (!Array.isArray(value)) return []
  const out: AssistantAction[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const action = parseAction(entry as Raw)
    if (action) out.push(action)
    if (out.length >= MAX_ACTIONS) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Description — what the user actually approves
// ---------------------------------------------------------------------------

export interface ActionDescription {
  /** One line, imperative: "Add Priya Raman". */
  label: string
  /** The specifics underneath, when there are any. */
  detail?: string
}

export function describeAction(action: AssistantAction): ActionDescription {
  switch (action.type) {
    case 'add_contact': {
      const who = [action.firstName, action.lastName].filter(Boolean).join(' ')
      const detail = [
        [action.jobTitle, action.company].filter(Boolean).join(' at '),
        action.school,
        action.whereWeMet && `met at ${action.whereWeMet}`,
        action.tagNames?.length && `tags: ${action.tagNames.join(', ')}`,
      ]
        .filter(Boolean)
        .join(' · ')
      return { label: `Add ${who}`, detail: detail || undefined }
    }
    case 'schedule_meeting': {
      const when = new Date(action.startsAtLocal)
      const stamp = isValid(when)
        ? action.allDay
          ? format(when, 'EEE d MMM')
          : format(when, 'EEE d MMM, h:mm a')
        : action.startsAtLocal
      const detail = [
        stamp,
        !action.allDay && `${action.durationMinutes} min`,
        action.location,
        action.people.length && `with ${action.people.join(', ')}`,
      ]
        .filter(Boolean)
        .join(' · ')
      return { label: `Schedule “${action.title}”`, detail }
    }
    case 'log_caught_up':
      return {
        label: `Mark caught up with ${action.person}`,
        detail: action.date ? formatDate(action.date) : 'today',
      }
    case 'add_note':
      return { label: `Add a note to ${action.person}`, detail: action.text }
    case 'add_tags':
      return {
        label: `Tag ${action.person}`,
        detail: action.tagNames.join(', '),
      }
    case 'set_followup':
      return {
        label: `Follow up with ${action.person}`,
        detail: FREQUENCY_OPTIONS[action.frequency].label,
      }
    case 'add_opportunity':
      return {
        label: `Track ${action.role} at ${action.company}`,
        detail: [
          OPPORTUNITY_TYPES[action.opportunityType],
          OPPORTUNITY_STAGES[action.stage].label,
          action.deadline && `due ${formatDate(action.deadline)}`,
          action.people.length && `with ${action.people.join(', ')}`,
        ]
          .filter(Boolean)
          .join(' · '),
      }
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ActionOutcome {
  action: AssistantAction
  status: 'done' | 'skipped' | 'failed'
  /** Past tense on success, the reason otherwise. */
  message: string
  /** Where the result lives, when it's somewhere worth going. */
  route?: string
}

/**
 * Find the contact a plan means by name.
 *
 * Deliberately conservative: an exact full-name match, then a unique
 * first-name match, then a unique substring. Anything ambiguous returns
 * nothing and the action is skipped with a reason — quietly writing to the
 * wrong Sarah is far worse than not writing at all.
 */
export function resolvePerson(name: string, index: Contact[]): Contact | undefined {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return undefined

  const exact = index.filter((c) => fullName(c).toLowerCase() === wanted)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return undefined

  const byFirst = index.filter((c) => c.firstName.toLowerCase() === wanted)
  if (byFirst.length === 1) return byFirst[0]
  if (byFirst.length > 1) return undefined

  const partial = index.filter((c) => fullName(c).toLowerCase().includes(wanted))
  return partial.length === 1 ? partial[0] : undefined
}

function unresolved(name: string, index: Contact[]): string {
  const matches = index.filter((c) =>
    fullName(c).toLowerCase().includes(name.trim().toLowerCase()),
  )
  return matches.length > 1
    ? `More than one contact matches “${name}” — do that one by hand.`
    : `No contact called “${name}”.`
}

/**
 * Run an approved plan.
 *
 * Contacts are created first, so "add Priya, then book coffee with her" can
 * resolve "Priya" to the person this same plan just created. Every action is
 * independent: one failure is reported against that action and the rest of the
 * plan still runs.
 */
export async function applyActions(
  actions: AssistantAction[],
  context: { contacts: Contact[]; tags: Tag[] },
): Promise<ActionOutcome[]> {
  // Local working copies so later actions can see what earlier ones created.
  const index = [...context.contacts]
  const tagPool = [...context.tags]

  const ordered = [
    ...actions.filter((a) => a.type === 'add_contact'),
    ...actions.filter((a) => a.type !== 'add_contact'),
  ]

  const outcomes: ActionOutcome[] = []
  for (const action of ordered) {
    try {
      outcomes.push(await runOne(action, index, tagPool))
    } catch (err) {
      console.error(err)
      outcomes.push({
        action,
        status: 'failed',
        message: 'Something went wrong saving this one.',
      })
    }
  }
  return outcomes
}

async function runOne(
  action: AssistantAction,
  index: Contact[],
  tagPool: Tag[],
): Promise<ActionOutcome> {
  switch (action.type) {
    case 'add_contact': {
      // Every other path into a new contact warns on a matching name +
      // company; a plan runs unattended once approved, so here it simply
      // doesn't add the second one. Anything later in the plan that names
      // this person still resolves — to the contact that already exists.
      const existing = await contactRepo.findDuplicates(
        action.firstName,
        action.lastName ?? '',
        action.company,
      )
      if (existing.length) {
        return {
          action,
          status: 'skipped',
          message: `${fullName(existing[0])} is already in your contacts`,
          route: ROUTES.contact(existing[0].id),
        }
      }

      const { ids, created } = await ensureTags(action.tagNames ?? [], tagPool)
      tagPool.push(...created)
      const contact = await contactRepo.create({
        firstName: action.firstName,
        lastName: action.lastName ?? '',
        company: action.company,
        jobTitle: action.jobTitle,
        school: action.school,
        connectionType: action.connectionType,
        source: action.source,
        whereWeMet: action.whereWeMet,
        howWeMet: action.howWeMet,
        email: action.email,
        phone: action.phone,
        notes: action.notes,
        dateMet: todayISO(),
        otherLinks: [],
        tagIds: ids,
        relationshipStrength: 3,
        contactFrequencyGoal: 'none',
      })
      index.push(contact)
      return {
        action,
        status: 'done',
        message: `Added ${fullName(contact)}`,
        route: ROUTES.contact(contact.id),
      }
    }

    case 'schedule_meeting': {
      const start = new Date(action.startsAtLocal)
      const end = action.allDay
        ? new Date(`${action.startsAtLocal.slice(0, 10)}T23:59`)
        : addMinutes(start, action.durationMinutes)

      const contactIds: string[] = []
      const missing: string[] = []
      for (const name of action.people) {
        const contact = resolvePerson(name, index)
        if (contact) contactIds.push(contact.id)
        else missing.push(name)
      }

      await eventRepo.create({
        title: action.title,
        location: action.location,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        allDay: action.allDay,
        contactIds,
        logged: false,
      })
      // A meeting with an unrecognised name is still a meeting worth having —
      // it goes in the calendar, and the miss is reported rather than hidden.
      return {
        action,
        status: 'done',
        message: missing.length
          ? `Scheduled — but couldn't link ${missing.join(', ')}`
          : 'Scheduled',
        route: ROUTES.calendar,
      }
    }

    case 'log_caught_up': {
      const contact = resolvePerson(action.person, index)
      if (!contact) {
        return { action, status: 'skipped', message: unresolved(action.person, index) }
      }
      await contactRepo.update(contact.id, {
        lastContactDate: action.date ?? todayISO(),
      })
      return {
        action,
        status: 'done',
        message: `Reconnect clock reset for ${contact.firstName}`,
        route: ROUTES.contact(contact.id),
      }
    }

    case 'add_note': {
      const contact = resolvePerson(action.person, index)
      if (!contact) {
        return { action, status: 'skipped', message: unresolved(action.person, index) }
      }
      // Append: a note the user wrote themselves is never overwritten.
      const notes = contact.notes?.trim()
        ? `${contact.notes.trim()}\n\n${action.text}`
        : action.text
      await contactRepo.update(contact.id, { notes })
      return {
        action,
        status: 'done',
        message: `Note added to ${contact.firstName}`,
        route: ROUTES.contact(contact.id),
      }
    }

    case 'add_tags': {
      const contact = resolvePerson(action.person, index)
      if (!contact) {
        return { action, status: 'skipped', message: unresolved(action.person, index) }
      }
      const { ids, created } = await ensureTags(action.tagNames, tagPool)
      tagPool.push(...created)
      const merged = [...contact.tagIds]
      for (const id of ids) if (!merged.includes(id)) merged.push(id)
      if (merged.length === contact.tagIds.length) {
        return { action, status: 'skipped', message: 'Already tagged with those.' }
      }
      await contactRepo.update(contact.id, { tagIds: merged })
      return {
        action,
        status: 'done',
        message: `Tagged ${contact.firstName}`,
        route: ROUTES.contact(contact.id),
      }
    }

    case 'set_followup': {
      const contact = resolvePerson(action.person, index)
      if (!contact) {
        return { action, status: 'skipped', message: unresolved(action.person, index) }
      }
      await contactRepo.update(contact.id, { contactFrequencyGoal: action.frequency })
      return {
        action,
        status: 'done',
        message: `${contact.firstName}: ${FREQUENCY_OPTIONS[action.frequency].label.toLowerCase()}`,
        route: ROUTES.contact(contact.id),
      }
    }

    case 'add_opportunity': {
      const contactIds = action.people
        .map((name) => resolvePerson(name, index)?.id)
        .filter((id): id is string => Boolean(id))
      await opportunityRepo.create({
        company: action.company,
        role: action.role,
        type: action.opportunityType,
        stage: action.stage,
        deadline: action.deadline,
        contactIds,
      })
      return {
        action,
        status: 'done',
        message: `${action.role} at ${action.company} added to the pipeline`,
        route: ROUTES.pipeline,
      }
    }
  }
}
