import { motion } from 'framer-motion'
import { MockAvatar, MockSurface } from './primitives'

interface Card {
  company: string
  role: string
  helper: { initials: string; color: React.ComponentProps<typeof MockAvatar>['color'] }
}

interface Column {
  label: string
  dot: string
  cards: Card[]
}

const COLUMNS: Column[] = [
  {
    label: 'Applied',
    dot: 'bg-sky-400',
    cards: [
      { company: 'Stripe', role: 'SWE Intern', helper: { initials: 'MC', color: 'sky' } },
    ],
  },
  {
    label: 'Interviewing',
    dot: 'bg-amber-400',
    cards: [
      { company: 'Figma', role: 'PM Intern', helper: { initials: 'PN', color: 'fuchsia' } },
      { company: 'Vanta', role: 'Founding Eng', helper: { initials: 'DO', color: 'orange' } },
    ],
  },
  {
    label: 'Offer',
    dot: 'bg-emerald-400',
    cards: [
      { company: 'Linear', role: 'Design Eng', helper: { initials: 'JK', color: 'violet' } },
    ],
  },
]

export function PipelineMockup() {
  return (
    <MockSurface className="w-full max-w-lg p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white">Pipeline</span>
        <span className="text-[11px] text-white/40">4 opportunities</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {COLUMNS.map((col, ci) => (
          <div key={col.label} className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
              <span className="truncate text-[10px] font-medium uppercase tracking-wide text-white/45">
                {col.label}
              </span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card, i) => (
                <motion.div
                  key={card.company}
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{
                    duration: 0.5,
                    delay: 0.1 + ci * 0.1 + i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5"
                >
                  <p className="truncate text-[12px] font-semibold text-white">
                    {card.company}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-white/45">{card.role}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <MockAvatar
                      initials={card.helper.initials}
                      color={card.helper.color}
                      size={18}
                    />
                    <span className="text-[9px] text-white/40">can intro</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockSurface>
  )
}
