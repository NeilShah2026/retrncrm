import { motion } from 'framer-motion'
import { Clock, Sparkles, Users } from 'lucide-react'
import { MockAvatar, MockSurface, MockTag } from './primitives'

const STATS = [
  { label: 'Contacts', value: '128' },
  { label: 'To reconnect', value: '6' },
  { label: 'This month', value: '14' },
]

interface Reconnect {
  initials: string
  color: React.ComponentProps<typeof MockAvatar>['color']
  name: string
  context: string
  overdue: string
}

const RECONNECT: Reconnect[] = [
  { initials: 'GL', color: 'rose', name: 'Grace Liu', context: 'Sequoia · Scout', overdue: '9 mo' },
  { initials: 'DO', color: 'orange', name: 'David Osei', context: 'Vanta · Founder', overdue: '3 mo' },
  { initials: 'PN', color: 'fuchsia', name: 'Priya Nair', context: 'Figma · PM', overdue: '6 wk' },
]

export function DashboardMockup() {
  return (
    <MockSurface className="w-full p-5 sm:p-6">
      {/* stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.08, ease: 'easeOut' }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <p className="text-2xl font-semibold text-white">{s.value}</p>
            <p className="mt-0.5 text-[11px] text-white/45">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* reconnect list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.75, ease: 'easeOut' }}
        className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-rose-300" />
          <span className="text-[12px] font-semibold text-white">
            Time to reconnect
          </span>
        </div>
        <div className="space-y-2.5">
          {RECONNECT.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.9 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <MockAvatar initials={r.initials} color={r.color} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-white">{r.name}</p>
                <p className="truncate text-[10px] text-white/40">{r.context}</p>
              </div>
              <MockTag tone="rose">{r.overdue} overdue</MockTag>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* footer row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.3 }}
        className="mt-4 flex items-center justify-between rounded-xl border border-indigo-400/20 bg-indigo-500/[0.07] px-4 py-3"
      >
        <div className="flex items-center gap-2 text-[12px] text-white/70">
          <Users className="h-3.5 w-3.5 text-indigo-300" />
          Jordan added 3 people this week
        </div>
        <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
      </motion.div>
    </MockSurface>
  )
}
