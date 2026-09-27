import { X } from 'lucide-react'
import { Badge, SuggestedBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ColdReview, ReviewArea } from '@/lib/ai/coldEmail'

const AREA_LABEL: Record<ReviewArea, string> = {
  subject: 'Subject',
  length: 'Length',
  opening: 'Opening',
  'why-them': 'Why them',
  ask: 'The ask',
  tone: 'Tone',
  other: 'Other',
}

const VERDICT: Record<ColdReview['verdict'], { label: string; tone: 'success' | 'warning' | 'destructive' }> = {
  send: { label: 'Ready to send', tone: 'success' },
  tweak: { label: 'A few fixes', tone: 'warning' },
  rework: { label: 'Needs rework', tone: 'destructive' },
}

/**
 * What the review found, quoting the words it's about. It never rewrites the
 * email: the student fixes it, which is how they learn to write the next one.
 */
export function ReviewPanel({
  review,
  stale,
  onDismiss,
}: {
  review: ColdReview
  /** The email has changed since this was written. */
  stale: boolean
  onDismiss: () => void
}) {
  const verdict = VERDICT[review.verdict]
  return (
    <div className={cn('rounded-lg border', stale && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3 border-b px-3 py-2.5">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={verdict.tone}>{verdict.label}</Badge>
            <SuggestedBadge>Review</SuggestedBadge>
            {stale && <span className="text-xs text-muted-foreground">Edited since — review again</span>}
          </div>
          {review.summary && <p className="text-sm text-text-secondary">{review.summary}</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDismiss} aria-label="Dismiss review">
          <X />
        </Button>
      </div>
      {review.issues.length === 0 ? (
        <p className="px-3 py-2.5 text-sm text-muted-foreground">Nothing that would cost you a reply.</p>
      ) : (
        <ul>
          {review.issues.map((issue, i) => (
            <li key={i} className="flex gap-3 border-b px-3 py-2.5 last:border-b-0">
              <span className="w-20 shrink-0 pt-px text-xs font-medium text-muted-foreground">
                {AREA_LABEL[issue.area]}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm">
                  {issue.severity === 'fix' && (
                    <span className="mr-1.5 font-medium text-warning">Fix</span>
                  )}
                  {issue.note}
                </p>
                {issue.quote && (
                  <p className="border-l-2 pl-2 text-xs text-muted-foreground">“{issue.quote}”</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
