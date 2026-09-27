import { askClaudeJson, AiRequestError, truncate } from './client'
import type { ColdTarget } from '@/types'

/**
 * Writing and reviewing cold emails.
 *
 * A cold email lives or dies on one thing the model can't know: why *this*
 * person. So the draft is built around the sender's own `hook` and nothing
 * else — no invented shared interests, no praise for work it hasn't seen —
 * and when there's no hook it writes a plainer email rather than faking one.
 * The review is the same instinct pointed the other way: it names what will
 * get the email ignored, quoting the line, instead of rewriting it.
 */

/** Who's writing. Anything missing is simply left out of the prompt. */
export interface Sender {
  name: string
  school?: string
  major?: string
  gradYear?: string
  headline?: string
}

export interface ColdDraft {
  subject: string
  body: string
}

function senderBrief(s: Sender): string {
  return [
    `Name: ${s.name.trim() || 'the sender'}`,
    s.school && `School: ${s.school}`,
    s.major && `Studying: ${s.major}`,
    s.gradYear && `Graduating: ${s.gradYear}`,
    s.headline && `About them: ${truncate(s.headline, 200)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function targetBrief(t: ColdTarget): string {
  return [
    `Name: ${`${t.firstName} ${t.lastName}`.trim() || 'unknown'}`,
    t.role && `Role: ${t.role}`,
    t.company && `Company: ${t.company}`,
    t.hook ? `Why the sender is writing to them: ${truncate(t.hook, 600)}` : 'Why the sender is writing to them: not given',
    t.notes && `Other notes: ${truncate(t.notes, 400)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

const DRAFT_SYSTEM = `You write cold emails for a university student reaching \
out to a professional they have never met.

Return JSON only: {"subject": string, "body": string}. No markdown, no preamble.

What makes it work:
- Short. The body is under 120 words — four to six sentences.
- First line: who the sender is, in one clause (school, year, what they study).
- Then why THIS person, using only the reason given. That line is the whole \
point of the email. If no reason is given, say plainly what the sender is \
exploring and why the person's role is relevant — never invent a shared \
interest, an article they wrote, a mutual connection, or anything else not \
provided.
- One small, specific ask: a 15-minute call or two questions over email. Never \
ask for a job, an internship, or a referral in a first email.
- Make it easy to say no or to answer later.
- Sign off with the sender's first name on its own line.
- Subject line: specific and under eight words. Mention the school or the \
reason. No "Quick question", no "Reaching out", no clickbait.

Never: "I hope this email finds you well", flattery, "I know you're busy", \
exclamation marks, placeholders or brackets to fill in.`

const FOLLOW_UP_SYSTEM = `You write a follow-up to a cold email a university \
student sent to a professional who has not replied.

Return JSON only: {"subject": string, "body": string}. No markdown, no preamble.

- It is sent as a reply on the same thread, so the subject is "Re: " plus the \
original subject.
- Two to three sentences, under 60 words. Brief is respectful.
- Restate the one ask in a sentence. Never guilt ("just bumping this", "since \
I haven't heard back"), never apologise for writing again.
- If the reason for writing is given, one clause of it may be restated; add \
nothing that wasn't provided.
- Sign off with the sender's first name on its own line.`

/**
 * A first draft — or, once something has been sent, the next follow-up.
 * `current` is what's in the editor now; when it has substance the model
 * keeps its intent rather than starting over.
 */
export async function draftColdEmail({
  target,
  sender,
  current,
}: {
  target: ColdTarget
  sender: Sender
  current?: Partial<ColdDraft>
}): Promise<ColdDraft> {
  const followUp = target.sends.length > 0
  const firstSubject = target.sends[0]?.subject
  const firstBody = target.sends[0]?.body
  const lines = [
    'Sender:',
    senderBrief(sender),
    '',
    'Recipient:',
    targetBrief(target),
  ]
  if (followUp) {
    lines.push(
      '',
      `Emails sent so far: ${target.sends.length}`,
      `Original subject: ${firstSubject || '(unknown)'}`,
    )
    if (firstBody) lines.push('Original email:', truncate(firstBody, 1200))
  }
  if (current?.body?.trim()) {
    lines.push('', 'The sender’s own draft — keep what they meant, fix how it reads:', truncate(current.body, 1500))
  }

  const draft = await askClaudeJson<Partial<ColdDraft>>({
    system: followUp ? FOLLOW_UP_SYSTEM : DRAFT_SYSTEM,
    maxTokens: 700,
    messages: [{ role: 'user', content: lines.join('\n') }],
  })
  const subject = typeof draft.subject === 'string' ? draft.subject.trim() : ''
  const body = typeof draft.body === 'string' ? draft.body.trim() : ''
  if (!body) throw new AiRequestError('The draft came back empty.')
  return { subject, body }
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export type ReviewArea = 'subject' | 'length' | 'opening' | 'why-them' | 'ask' | 'tone' | 'other'

export interface ReviewIssue {
  area: ReviewArea
  /** `fix` would likely cost a reply; `consider` is polish. */
  severity: 'fix' | 'consider'
  note: string
  /** The words in the email the note is about, verbatim. */
  quote?: string
}

export interface ColdReview {
  verdict: 'send' | 'tweak' | 'rework'
  /** One sentence on the email as a whole. */
  summary: string
  issues: ReviewIssue[]
}

const REVIEW_SYSTEM = `You review cold emails that university students are \
about to send to professionals they have never met. Be direct and specific; \
the student wants to know what will get it ignored.

Return JSON only:
{"verdict": "send" | "tweak" | "rework",
 "summary": string,
 "issues": [{"area": "subject" | "length" | "opening" | "why-them" | "ask" | "tone" | "other",
             "severity": "fix" | "consider",
             "note": string,
             "quote": string}]}

Judge it on:
- subject: specific, under eight words, gives a reason to open.
- length: a first email over about 150 words is too long; a follow-up over 70.
- opening: says who they are in the first line, no throat-clearing.
- why-them: a concrete reason for writing to this person. Generic praise \
("I admire your career") does not count.
- ask: exactly one, small, and easy to say yes to (a short call, two \
questions). Asking a stranger for a job or referral is a "fix".
- tone: confident and plain; no flattery, apology, desperation or exclamation marks.

"summary" is one sentence. "note" says what to change in under 25 words. \
"quote" copies the exact words from the email the note is about, or is "" \
when it's about something missing. Give at most five issues, most important \
first; give none if it's ready. verdict is "send" when nothing is a "fix".`

const AREAS: ReviewArea[] = ['subject', 'length', 'opening', 'why-them', 'ask', 'tone', 'other']

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export async function reviewColdEmail({
  subject,
  body,
  target,
}: {
  subject: string
  body: string
  target: ColdTarget
}): Promise<ColdReview> {
  const followUp = target.sends.length > 0
  const raw = await askClaudeJson<Partial<ColdReview>>({
    system: REVIEW_SYSTEM,
    maxTokens: 900,
    messages: [
      {
        role: 'user',
        content: [
          `This is ${followUp ? `follow-up ${target.sends.length}` : 'the first email'} to:`,
          targetBrief(target),
          '',
          `Subject: ${subject.trim() || '(none)'}`,
          `Body (${wordCount(body)} words):`,
          truncate(body, 3000),
        ].join('\n'),
      },
    ],
  })

  // Trust the shape, not the model: anything unrecognised is dropped or
  // coerced, so a slightly-off answer still renders.
  const issues: ReviewIssue[] = (Array.isArray(raw.issues) ? raw.issues : [])
    .filter((i): i is ReviewIssue => Boolean(i) && typeof i.note === 'string' && i.note.trim() !== '')
    .slice(0, 5)
    .map((i) => ({
      area: AREAS.includes(i.area) ? i.area : 'other',
      severity: i.severity === 'fix' ? 'fix' : 'consider',
      note: i.note.trim(),
      // Only keep a quote that's actually in the email.
      quote:
        typeof i.quote === 'string' && i.quote.trim() && `${subject}\n${body}`.includes(i.quote.trim())
          ? i.quote.trim()
          : undefined,
    }))
  const hasFix = issues.some((i) => i.severity === 'fix')
  const verdict: ColdReview['verdict'] =
    raw.verdict === 'rework' ? 'rework' : hasFix ? 'tweak' : raw.verdict === 'tweak' ? 'tweak' : 'send'

  return {
    verdict,
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    issues,
  }
}
