import { MockAvatar, MockSurface } from './primitives'

interface Card {
  company: string
  role: string
  helper: string
  due?: string
}

const COLUMNS: { label: string; dot: string; cards: Card[] }[] = [
  { label: 'Applied', dot: 'bg-blue-500', cards: [{ company: 'Stripe', role: 'SWE Intern', helper: 'Marcus Chen', due: 'Due Mar 14' }] },
  { label: 'Interviewing', dot: 'bg-amber-500', cards: [{ company: 'Figma', role: 'PM Intern', helper: 'Priya Nair' }, { company: 'Vanta', role: 'Founding Eng', helper: 'David Osei' }] },
  { label: 'Offer', dot: 'bg-emerald-500', cards: [{ company: 'Linear', role: 'Design Eng', helper: 'Jae Kim' }] },
]

/** Three stages of the board, compact cards, linked helpers. */
export function PipelineMockup() {
  return (
    <MockSurface className="w-full">
      <div className="grid grid-cols-3 gap-px bg-border">
        {COLUMNS.map((col) => (
          <div key={col.label} className="min-w-0 bg-bg-sunken/40">
            <div className="flex h-8 items-center gap-1.5 border-b px-2">
              <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
              <span className="truncate text-[11px] font-medium">{col.label}</span>
              <span className="tnum text-[11px] text-muted-foreground">{col.cards.length}</span>
            </div>
            <div className="space-y-1.5 p-1.5">
              {col.cards.map((card) => (
                <div key={card.company} className="rounded-md border bg-card p-2">
                  <p className="truncate text-[12px] font-medium leading-tight">{card.company}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{card.role}</p>
                  <div className="mt-2 flex items-center justify-between border-t pt-1.5">
                    <span className="tnum truncate text-[10px] text-muted-foreground">{card.due ?? 'Internship'}</span>
                    <MockAvatar name={card.helper} size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockSurface>
  )
}
