import { Badge } from '@/components/ui/badge'
import { COLD_STAGES, type ColdStage } from '@/lib/coldEmail'
import { MockHeader, MockSurface } from './primitives'

interface Target {
  name: string
  company: string
  role: string
  stage: ColdStage
  when: string
}

const TARGETS: Target[] = [
  { name: 'Nora Patel', company: 'Ramp', role: 'Product Lead', stage: 'due', when: 'Oct 2' },
  { name: 'Tom Alvarez', company: 'Notion', role: 'Recruiter', stage: 'waiting', when: 'Oct 6' },
  { name: 'Hana Sato', company: 'Datadog', role: 'Staff Engineer', stage: 'replied', when: 'Sep 28' },
  { name: 'Leo Brandt', company: 'Plaid', role: 'Design Manager', stage: 'drafting', when: '' },
]

const REVIEW = [
  'Ask is buried in the last line — lead with it',
  'No length on the ask — “15 minutes” is easier to say yes to',
]

/** The target list beside one draft and its review — the page as it is. */
export function ColdEmailMockup() {
  return (
    <MockSurface className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <ul className="border-b sm:border-b-0 sm:border-r">
          {TARGETS.map((t, i) => (
            <li
              key={t.name}
              className={`flex items-center gap-3 border-b px-3 py-2 last:border-b-0 ${i === 0 ? 'bg-bg-sunken' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium leading-tight">{t.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {t.company} · {t.role}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <Badge variant={COLD_STAGES[t.stage].tone} className="text-[11px]">
                  {COLD_STAGES[t.stage].label}
                </Badge>
                {t.when && <span className="tnum text-[10px] text-muted-foreground">{t.when}</span>}
              </span>
            </li>
          ))}
        </ul>

        <div className="min-w-0">
          <div className="border-b px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Follow-up 1 of 2 · Today</p>
            <p className="mt-0.5 truncate text-[12px] font-medium">Babson junior — your move from Stripe to Ramp</p>
          </div>
          <div className="px-3 py-2.5 text-[12px] leading-relaxed text-text-secondary">
            <p>
              Hi Nora — following up on my note last week. I’m a junior at Babson studying
              finance, and your post on building Ramp’s bill-pay team is why I’m writing…
            </p>
          </div>
          <MockHeader action="Suggested">Review</MockHeader>
          <ul className="px-3 py-2">
            {REVIEW.map((line) => (
              <li key={line} className="flex items-start gap-2 py-1 text-[12px] text-text-secondary">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-border-strong" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MockSurface>
  )
}
