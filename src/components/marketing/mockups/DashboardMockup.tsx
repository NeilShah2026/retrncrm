import { Check, Coffee } from 'lucide-react'
import { MockAvatar, MockHeader, MockSurface } from './primitives'

const NEXT_UP = [
  { name: 'Grace Liu', kind: 'Reconnect', why: '3 months since the info session · quarterly cadence', overdue: true },
  { name: 'David Osei', kind: 'Prep', why: 'Coffee tomorrow 3:00 · ask about the Vanta founding team' },
  { name: 'Priya Nair', kind: 'Pipeline', why: 'Figma PM internship closes Friday · she offered a referral' },
]

/** The dashboard as it actually looks: metric strip, then a "Next up" list. */
export function DashboardMockup() {
  return (
    <MockSurface className="w-full">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b px-4 py-2.5">
        <span className="flex items-baseline gap-1.5">
          <span className="tnum text-lg font-semibold leading-none">128</span>
          <span className="text-xs text-muted-foreground">contacts</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="tnum text-lg font-semibold leading-none text-warning">3</span>
          <span className="text-xs text-muted-foreground">overdue</span>
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span className="flex items-baseline gap-1.5">
          <span className="tnum text-sm font-semibold leading-none">2</span>
          <span className="text-[11px] text-muted-foreground">meetings this week</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="tnum text-sm font-semibold leading-none">5</span>
          <span className="text-[11px] text-muted-foreground">open applications</span>
        </span>
      </div>

      <MockHeader action="Suggested">Next up</MockHeader>
      <ul>
        {NEXT_UP.map((r) => (
          <li key={r.name} className="flex h-11 items-center gap-2.5 border-b px-4 last:border-b-0">
            <MockAvatar name={r.name} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{r.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                <span className={r.overdue ? 'text-warning' : 'text-text-secondary'}>{r.kind}</span> · {r.why}
              </span>
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground">
              {r.kind === 'Prep' ? <Coffee className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </span>
          </li>
        ))}
      </ul>
    </MockSurface>
  )
}
