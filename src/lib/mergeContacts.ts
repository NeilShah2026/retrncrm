import type { Contact } from '@/types'
import type { ContactPatch } from '@/services/types'

/** Scalar fields where we fill a missing value on the primary from the duplicate. */
const FILL_KEYS = [
  'photo',
  'company',
  'jobTitle',
  'industry',
  'linkedinUrl',
  'email',
  'phone',
  'twitter',
  'connectionType',
  'school',
  'gradYear',
  'major',
  'source',
  'introducedById',
  'talkingPoints',
  'howWeMet',
  'whereWeMet',
  'dateMet',
] as const

/**
 * Build the patch to apply to `primary` when merging `dup` into it: fill any
 * fields the primary is missing, union tags/links, combine interaction
 * histories, and keep the stronger relationship signal. `dup` is then deleted
 * by the caller. The primary keeps its id, so links to it stay valid.
 */
export function buildMergePatch(primary: Contact, dup: Contact): ContactPatch {
  const patch: ContactPatch = {}
  const p = patch as Record<string, unknown>
  for (const k of FILL_KEYS) {
    if (!primary[k] && dup[k]) p[k] = dup[k]
  }

  if ((dup.relationshipStrength ?? 0) > (primary.relationshipStrength ?? 0)) {
    patch.relationshipStrength = dup.relationshipStrength
  }
  if (
    (!primary.contactFrequencyGoal || primary.contactFrequencyGoal === 'none') &&
    dup.contactFrequencyGoal &&
    dup.contactFrequencyGoal !== 'none'
  ) {
    patch.contactFrequencyGoal = dup.contactFrequencyGoal
  }

  const tagIds = Array.from(new Set([...primary.tagIds, ...dup.tagIds]))
  if (tagIds.length !== primary.tagIds.length) patch.tagIds = tagIds

  const urls = new Set(primary.otherLinks.map((l) => l.url))
  const extraLinks = dup.otherLinks.filter((l) => !urls.has(l.url))
  if (extraLinks.length) patch.otherLinks = [...primary.otherLinks, ...extraLinks]

  const ids = new Set(primary.interactions.map((i) => i.id))
  const extraInts = dup.interactions.filter((i) => !ids.has(i.id))
  if (extraInts.length) {
    patch.interactions = [...primary.interactions, ...extraInts].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
  }

  const later = [primary.lastContactDate, dup.lastContactDate]
    .filter(Boolean)
    .sort()
    .at(-1)
  if (later && later !== primary.lastContactDate) patch.lastContactDate = later

  if (dup.notes && !primary.notes) patch.notes = dup.notes
  else if (dup.notes && primary.notes && !primary.notes.includes(dup.notes)) {
    patch.notes = `${primary.notes}\n\n---\n\n${dup.notes}`
  }

  return patch
}
