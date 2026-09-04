import { askClaudeJson, truncate } from './client'
import { contactBrief } from './context'
import type { Contact, Tag } from '@/types'

/**
 * Turns everything you already recorded about someone into things to actually
 * say to them.
 *
 * The prep dialog already shows the raw material — how you met, past
 * activity, notes. This is the step a person does in their head on the walk
 * over: pick the two threads worth picking up and the question worth asking.
 * The result is offered as text to save into `talkingPoints`, never written
 * behind the user's back.
 */

const SYSTEM = `You prepare someone for a short catch-up conversation with a \
person in their network.

Reply with a single JSON object and nothing else:
{"points": ["…", "…"], "question": "…"}

Rules:
- 3 to 5 points. Each is one line, under 18 words, written as something to \
say or ask — not a summary of what is already in the notes.
- Ground every point in a fact you were given. If the record is thin, say so \
in fewer, more general points rather than inventing history.
- "question" is the single best open question to ask them, in their words \
not yours.
- No greetings, no small-talk suggestions about weather or travel, no \
flattery. Nothing the user would be embarrassed to have been coached on.`

interface RawPrep {
  points?: unknown
  question?: unknown
}

/** Talking points as markdown bullets, ready to drop into the field. */
export async function generateTalkingPoints(
  contact: Contact,
  tagMap: Map<string, Tag>,
): Promise<string> {
  const raw = await askClaudeJson<RawPrep>({
    system: SYSTEM,
    maxTokens: 500,
    messages: [{ role: 'user', content: contactBrief(contact, tagMap) }],
  })

  const points = (Array.isArray(raw.points) ? raw.points : [])
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .slice(0, 5)
    .map((p) => `- ${truncate(p.replace(/^[-*•]\s*/, ''), 160)}`)

  const question =
    typeof raw.question === 'string' && raw.question.trim()
      ? `- Ask: ${truncate(raw.question, 180)}`
      : ''

  const lines = [...points, question].filter(Boolean)
  if (lines.length === 0) throw new Error('No talking points came back.')
  return lines.join('\n')
}
