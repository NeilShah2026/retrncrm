import { askClaude, truncate } from './client'
import { contactBrief } from './context'
import { TEMPLATE_CATEGORIES } from '@/lib/constants'
import type { Contact, OutreachTemplate, Tag } from '@/types'

/**
 * Rewrites the merged template into a message that sounds like it was written
 * for this one person.
 *
 * The template still decides the *shape* — its category is the ask, its body
 * is the tone to match — so a user's own voice survives. The result lands in
 * the same editable body they already had; nothing is sent, and the template
 * itself is never modified.
 */

const SYSTEM = `You write short first-person outreach messages for a student \
or early-career professional contacting someone in their network.

Return only the message body — no subject line, no preamble, no quotes, no \
markdown, no "Here's a draft". Sign off with the sender's name on its own line.

Rules:
- Match the tone and length of the example template. Shorter is better; \
five sentences is a lot.
- Use only facts given about the recipient. Never invent a shared class, \
a mutual friend, a project, or anything you were not told.
- Reference how they actually met if that context exists — that specific \
detail is the whole point of the message.
- Plain, direct, human. No "I hope this email finds you well", no flattery, \
no corporate filler.
- Leave no placeholders or brackets to fill in.`

export interface DraftRequest {
  contact: Contact
  template: OutreachTemplate
  tagMap: Map<string, Tag>
  myName: string
  /** The merged template text, as the user currently sees it. */
  currentBody: string
}

export async function draftOutreach({
  contact,
  template,
  tagMap,
  myName,
  currentBody,
}: DraftRequest): Promise<string> {
  const purpose = TEMPLATE_CATEGORIES[template.category]?.label ?? template.name

  const draft = await askClaude({
    system: SYSTEM,
    maxTokens: 600,
    messages: [
      {
        role: 'user',
        content: [
          `Sender: ${myName.trim() || 'the sender'}`,
          `Purpose: ${purpose}`,
          '',
          'Recipient:',
          contactBrief(contact, tagMap),
          '',
          'Template to match in tone and length:',
          truncate(currentBody || template.body, 1200),
        ].join('\n'),
      },
    ],
  })

  // Models like to wrap prose in a fence when the ask sounds technical.
  return draft.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim()
}
