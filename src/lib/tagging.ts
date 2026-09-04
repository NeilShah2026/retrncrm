import { CONNECTION_TYPES, MEET_SOURCES, TAG_COLOR_KEYS } from '@/lib/constants'
import { tagRepo } from '@/services'
import type { ConnectionType, MeetSource, Tag } from '@/types'

/**
 * Tagging plumbing shared by the AI path and the non-AI one.
 *
 * Tagging is the most tedious thing this app asks of anyone: it is the field
 * that pays off months later and costs attention today, so it's the field
 * people skip. Everything here exists to make a tag arrive without being
 * typed — matching names to existing tags, creating the genuinely new ones,
 * and (when the model isn't reachable) guessing from the record itself.
 *
 * Nothing in this file calls a model. `lib/ai/tagging.ts` does that and hands
 * its answer back here to be resolved into real tag ids.
 */

/** At most this many tags get suggested for one person. */
export const MAX_TAGS_PER_CONTACT = 4

/** Longest tag name we'll accept from a model or a rule. */
const MAX_TAG_NAME_CHARS = 24

/**
 * What tagging needs to know about a person.
 *
 * A `Contact` satisfies this, and so does the in-progress form state in the
 * new-contact dialog — which is the point: you can be tagged before you exist
 * as a row.
 */
export interface TagSubject {
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  industry?: string
  school?: string
  major?: string
  gradYear?: string
  connectionType?: ConnectionType | ''
  source?: MeetSource | ''
  whereWeMet?: string
  howWeMet?: string
  notes?: string
}

/** A tag the app is proposing, either one that exists or one to create. */
export interface TagSuggestion {
  /** The tag's name — matching an existing tag's name when `tagId` is set. */
  name: string
  /** Set when this resolves to a tag the user already has. */
  tagId?: string
}

/** Trim to a single clean line, or undefined if it isn't a usable tag name. */
export function normalizeTagName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.replace(/\s+/g, ' ').trim().replace(/^#/, '')
  if (!name || name.length > MAX_TAG_NAME_CHARS) return undefined
  if (/^(null|none|n\/a|unknown|undefined)$/i.test(name)) return undefined
  return name
}

/** Two tag names are the same tag if they only differ by case/whitespace. */
export function sameTagName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function findTagByName(name: string, tags: Tag[]): Tag | undefined {
  return tags.find((t) => sameTagName(t.name, name))
}

/**
 * Names → suggestions, deduped, capped, and with existing tags identified.
 * `exclude` drops tags the contact already carries so nothing is proposed
 * that's already on them.
 */
export function toSuggestions(
  names: string[],
  tags: Tag[],
  exclude: string[] = [],
  limit = MAX_TAGS_PER_CONTACT,
): TagSuggestion[] {
  const out: TagSuggestion[] = []
  for (const raw of names) {
    const name = normalizeTagName(raw)
    if (!name) continue
    if (out.some((s) => sameTagName(s.name, name))) continue
    const existing = findTagByName(name, tags)
    if (existing && exclude.includes(existing.id)) continue
    out.push(existing ? { name: existing.name, tagId: existing.id } : { name })
    if (out.length >= limit) break
  }
  return out
}

/**
 * Tag ids for a list of names, creating whatever doesn't exist yet.
 *
 * `known` is the tag list as the caller sees it (from `useTags`), which is
 * also what keeps colors rotating through the palette rather than all landing
 * on the same one. Tags created here are returned too, so a caller resolving
 * several contacts in a row doesn't create the same tag twice.
 */
export async function ensureTags(
  names: string[],
  known: Tag[],
): Promise<{ ids: string[]; created: Tag[] }> {
  const pool = [...known]
  const created: Tag[] = []
  const ids: string[] = []

  for (const raw of names) {
    const name = normalizeTagName(raw)
    if (!name) continue
    const existing = findTagByName(name, pool)
    if (existing) {
      if (!ids.includes(existing.id)) ids.push(existing.id)
      continue
    }
    const color = TAG_COLOR_KEYS[pool.length % TAG_COLOR_KEYS.length]
    const tag = await tagRepo.create({ name, color })
    pool.push(tag)
    created.push(tag)
    ids.push(tag.id)
  }
  return { ids, created }
}

/** Everything about a person that a tag could plausibly be drawn from. */
export function subjectText(subject: TagSubject): string {
  return [
    subject.company,
    subject.jobTitle,
    subject.industry,
    subject.school,
    subject.major,
    subject.whereWeMet,
    subject.howWeMet,
    subject.notes,
  ]
    .filter(Boolean)
    .join(' \n ')
}

/** True when `name` appears in `text` as a whole word (or phrase). */
function mentions(text: string, name: string): boolean {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(text)
}

/**
 * The offline suggester — what you get when AI is unconfigured or unreachable.
 *
 * It only proposes tags it can point at: one the user already has whose name
 * shows up in the record, or a category they picked themselves (industry,
 * relationship, where you met). It will never read a note the way the model
 * does, and that's fine — the rule here is that it doesn't guess.
 */
export function suggestTagsLocally(
  subject: TagSubject,
  tags: Tag[],
  exclude: string[] = [],
): TagSuggestion[] {
  const text = subjectText(subject)
  const names: string[] = []

  // Existing vocabulary first: reusing a tag is always better than adding one.
  for (const tag of tags) {
    if (exclude.includes(tag.id)) continue
    if (mentions(text, tag.name)) names.push(tag.name)
  }

  // Then the fields that are already a category by the time they're filled in.
  if (subject.industry) names.push(subject.industry)
  if (subject.connectionType) {
    names.push(CONNECTION_TYPES[subject.connectionType as ConnectionType].label)
  }
  if (subject.source) {
    names.push(MEET_SOURCES[subject.source as MeetSource].label)
  }

  return toSuggestions(names, tags, exclude)
}
