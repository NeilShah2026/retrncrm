import { motion } from 'framer-motion'
import { Link2, MapPin, Sparkles } from 'lucide-react'
import { MockAvatar, MockSurface, MockTag } from './primitives'

interface Person {
  initials: string
  color: React.ComponentProps<typeof MockAvatar>['color']
  name: string
  role: string
  met: string
  tags: { label: string; tone: React.ComponentProps<typeof MockTag>['tone'] }[]
}

const PEOPLE: Person[] = [
  {
    initials: 'DO',
    color: 'orange',
    name: 'David Osei',
    role: 'Co-founder & CTO · Vanta',
    met: 'MIT Hackathon',
    tags: [
      { label: 'founder', tone: 'indigo' },
      { label: 'mentor', tone: 'violet' },
    ],
  },
  {
    initials: 'PN',
    color: 'fuchsia',
    name: 'Priya Nair',
    role: 'Product Manager · Figma',
    met: 'Career fair',
    tags: [{ label: 'recruiter', tone: 'emerald' }],
  },
  {
    initials: 'MC',
    color: 'sky',
    name: 'Marcus Chen',
    role: 'SWE · Stripe',
    met: 'Coffee chat',
    tags: [{ label: 'referral', tone: 'amber' }],
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export function ContactsMockup() {
  return (
    <MockSurface className="w-full max-w-md p-5">
      {/* LinkedIn paste bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-4 flex items-center gap-2.5 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.07] px-3 py-2.5"
      >
        <Link2 className="h-4 w-4 shrink-0 text-indigo-300" />
        <span className="flex-1 truncate text-[13px] text-white/50">
          linkedin.com/in/davidosei
        </span>
        <span className="flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-semibold text-white">
          <Sparkles className="h-3 w-3" />
          Autofill
        </span>
      </motion.div>

      <div className="space-y-2">
        {PEOPLE.map((p, i) => (
          <motion.div
            key={p.name}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <MockAvatar initials={p.initials} color={p.color} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-white">
                  {p.name}
                </span>
                {p.tags.map((t) => (
                  <MockTag key={t.label} tone={t.tone}>
                    {t.label}
                  </MockTag>
                ))}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/45">{p.role}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[10px] text-white/35">
              <MapPin className="h-3 w-3" />
              {p.met}
            </div>
          </motion.div>
        ))}
      </div>
    </MockSurface>
  )
}
