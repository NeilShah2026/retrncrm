import { truncate } from './client'
import { getReconnectStatus } from '@/lib/reconnect'
import { CONNECTION_TYPES, INTERACTION_TYPES, MEET_SOURCES } from '@/lib/constants'
import { fullName, formatDate } from '@/lib/format'
import type { Contact, Tag } from '@/types'

/**
 * One contact, described for the model.
 *
 * Shared by every single-contact feature (drafting, prep) so they see the same
 * facts and can't contradict each other. Only fields the user actually filled
 * in appear — an empty field is a fact the model must not invent around.
 */
export function contactBrief(contact: Contact, tagMap: Map<string, Tag>): string {
  const lines: string[] = [`Name: ${fullName(contact)}`]

  const role = [contact.jobTitle, contact.company].filter(Boolean).join(' at ')
  if (role) lines.push(`Role: ${role}`)
  if (contact.industry) lines.push(`Industry: ${contact.industry}`)

  const school = [
    contact.school,
    contact.major,
    contact.gradYear && `class of ${contact.gradYear}`,
  ]
    .filter(Boolean)
    .join(', ')
  if (school) lines.push(`School: ${school}`)

  if (contact.connectionType) {
    lines.push(`Relationship: ${CONNECTION_TYPES[contact.connectionType].label}`)
  }

  const met = [
    contact.howWeMet,
    contact.whereWeMet,
    contact.source ? MEET_SOURCES[contact.source].label : undefined,
    contact.dateMet ? `on ${formatDate(contact.dateMet)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  if (met) lines.push(`How you met: ${met}`)

  const tags = contact.tagIds
    .map((id) => tagMap.get(id)?.name)
    .filter(Boolean)
    .join(', ')
  if (tags) lines.push(`Tags: ${tags}`)

  const status = getReconnectStatus(contact)
  lines.push(
    `Last contact: ${contact.lastContactDate ? formatDate(contact.lastContactDate) : 'never'} (${status.reason})`,
  )

  if (contact.talkingPoints) {
    lines.push(`Existing talking points: ${truncate(contact.talkingPoints, 400)}`)
  }
  if (contact.notes) lines.push(`Notes: ${truncate(contact.notes, 700)}`)

  const recent = [...contact.interactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
  if (recent.length) {
    lines.push('Recent activity:')
    for (const it of recent) {
      const label = INTERACTION_TYPES[it.type]?.label ?? 'Note'
      lines.push(`- ${formatDate(it.date)} ${label}: ${truncate(it.summary, 160) || '—'}`)
    }
  }

  return lines.join('\n')
}
