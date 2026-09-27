import * as React from 'react'
import { toast } from 'sonner'
import { Copy, ExternalLink, Lock, Mail, PenLine, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SuggestedBadge } from '@/components/ui/badge'
import { useFeatureGate } from '@/hooks/useFeatureGate'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import {
  draftColdEmail,
  reviewColdEmail,
  wordCount,
  type ColdReview,
  type Sender,
} from '@/lib/ai/coldEmail'
import { gmailComposeUrl, mailtoUrl, sortedSends } from '@/lib/coldEmail'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { coldTargetRepo } from '@/services'
import { ReviewPanel } from './ReviewPanel'
import type { ColdTarget } from '@/types'

/** Past this, a first email reads as a wall of text; a follow-up, much sooner. */
const LONG_FIRST = 150
const LONG_FOLLOW_UP = 70
/** How long typing has to pause before the draft is saved. */
const SAVE_AFTER_MS = 700

/**
 * The email being written to one person. The text is saved to the target as
 * it's typed, so it survives a closed tab; nothing is ever sent from here —
 * it goes out from Gmail or the mail app, and gets logged after.
 *
 * Keyed by the parent on the target and its send count, so logging a send
 * (which clears the draft) starts this fresh.
 */
export function ColdEmailEditor({ target, sender }: { target: ColdTarget; sender: Sender }) {
  const gate = useFeatureGate()
  const canAi = gate.can('coldEmailAI')
  const [aiOff, setAiOff] = React.useState(() => !isAiAvailable())

  const [subject, setSubject] = React.useState(target.draftSubject ?? '')
  const [body, setBody] = React.useState(target.draftBody ?? '')
  const [suggested, setSuggested] = React.useState(false)
  const [drafting, setDrafting] = React.useState(false)
  const [reviewing, setReviewing] = React.useState(false)
  const [review, setReview] = React.useState<{ result: ColdReview; of: string } | null>(null)
  const reviewRef = React.useRef<HTMLDivElement>(null)

  // The review lands under the editor, usually below the fold of the pane;
  // bring it up, or pressing Review looks like it did nothing.
  React.useEffect(() => {
    if (review) reviewRef.current?.scrollIntoView({ block: 'nearest' })
  }, [review])

  const isFollowUp = target.sends.length > 0
  const words = wordCount(body)
  const tooLong = words > (isFollowUp ? LONG_FOLLOW_UP : LONG_FIRST)
  const leftovers = /\[[^\]]+\]|\{\{[^}]+\}\}/.test(`${subject} ${body}`)

  // Save as they type, and once more on the way out.
  const pending = React.useRef<{ subject: string; body: string } | null>(null)
  const timer = React.useRef<number | undefined>(undefined)
  const flush = React.useCallback(() => {
    window.clearTimeout(timer.current)
    const next = pending.current
    if (!next) return
    pending.current = null
    void coldTargetRepo
      .update(target.id, { draftSubject: next.subject || undefined, draftBody: next.body || undefined })
      .catch((err) => {
        console.error(err)
        toast.error('Couldn’t save your draft.')
      })
  }, [target.id])
  React.useEffect(() => flush, [flush])

  function edit(next: { subject?: string; body?: string }) {
    const s = next.subject ?? subject
    const b = next.body ?? body
    if (next.subject !== undefined) setSubject(s)
    if (next.body !== undefined) setBody(b)
    setSuggested(false)
    pending.current = { subject: s, body: b }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER_MS)
  }

  async function writeDraft() {
    if (!gate.require('coldEmailAI')) return
    setDrafting(true)
    try {
      const draft = await draftColdEmail({ target, sender, current: { subject, body } })
      edit({ subject: draft.subject || subject, body: draft.body })
      setSuggested(true)
      setReview(null)
      track('cold_email_drafted', { follow_up: isFollowUp, has_hook: Boolean(target.hook) })
      toast.success('Draft written — read it before you send it.')
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        setAiOff(true)
        toast.info('Drafting isn’t set up here. You can still write it yourself.')
      } else {
        console.error(err)
        toast.error('Couldn’t write a draft. Your text is unchanged.')
      }
    } finally {
      setDrafting(false)
    }
  }

  async function runReview() {
    if (!gate.require('coldEmailAI')) return
    if (!body.trim()) {
      toast.info('Write something first, then review it.')
      return
    }
    setReviewing(true)
    try {
      const result = await reviewColdEmail({ subject, body, target })
      setReview({ result, of: `${subject}\n${body}` })
      track('cold_email_reviewed', { verdict: result.verdict, issues: result.issues.length })
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        setAiOff(true)
        toast.info('Reviews aren’t set up here.')
      } else {
        console.error(err)
        toast.error('Couldn’t review that. Try again in a moment.')
      }
    } finally {
      setReviewing(false)
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Couldn’t copy — select the text and copy it yourself.')
    }
  }

  // A follow-up belongs on the original thread when we know where it is.
  const thread = sortedSends(target.sends).findLast((s) => s.link)?.link
  const compose = { to: target.email, subject, body }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {isFollowUp ? `Follow-up ${target.sends.length}` : 'Your email'}
          {suggested && <SuggestedBadge />}
        </h3>
        {!aiOff && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void writeDraft()}
              loading={drafting}
              disabled={drafting || reviewing}
            >
              {canAi ? <PenLine /> : <Lock />}
              {body.trim() ? 'Rewrite' : isFollowUp ? 'Write follow-up' : 'Write draft'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runReview()}
              loading={reviewing}
              disabled={drafting || reviewing}
            >
              {canAi ? <ScanSearch /> : <Lock />}
              Review
            </Button>
          </div>
        )}
      </div>

      <Input
        aria-label="Subject"
        placeholder={isFollowUp ? 'Re: your original subject' : 'Subject'}
        value={subject}
        onChange={(e) => edit({ subject: e.target.value })}
        onBlur={flush}
      />
      <Textarea
        aria-label="Email"
        rows={isFollowUp ? 5 : 9}
        placeholder={
          isFollowUp
            ? 'Two or three sentences. Restate the ask; don’t apologise for writing again.'
            : 'Who you are in one line. Why them. One small ask. An easy out.'
        }
        value={body}
        onChange={(e) => edit({ body: e.target.value })}
        onBlur={flush}
        className="leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('tnum text-xs', tooLong || leftovers ? 'text-warning' : 'text-muted-foreground')}>
          {words} {words === 1 ? 'word' : 'words'}
          {tooLong && ` · long for a ${isFollowUp ? 'follow-up' : 'cold email'}`}
          {leftovers && ' · has a [placeholder] left in'}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => void copy(subject, 'Subject')} disabled={!subject}>
            <Copy />
            Subject
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void copy(body, 'Email')} disabled={!body}>
            <Copy />
            Email
          </Button>
          {thread ? (
            <Button variant="outline" size="sm" asChild>
              <a href={thread} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open thread
              </a>
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={gmailComposeUrl(compose)} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Gmail
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={mailtoUrl(compose)}>
                  <Mail />
                  Mail app
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      {review && (
        <div ref={reviewRef} className="scroll-mb-4">
          <ReviewPanel
            review={review.result}
            stale={review.of !== `${subject}\n${body}`}
            onDismiss={() => setReview(null)}
          />
        </div>
      )}
    </div>
  )
}
