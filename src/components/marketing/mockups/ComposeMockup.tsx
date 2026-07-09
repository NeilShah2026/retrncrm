import { motion } from 'framer-motion'
import { Coffee, Sparkles } from 'lucide-react'
import { MockAvatar, MockSurface } from './primitives'

const BRIEF = [
  'Last spoke 3 months ago at the MIT Hackathon',
  'Ask about their move to the Vanta founding team',
  'You both know Priya from the Figma career fair',
]

export function ComposeMockup() {
  return (
    <MockSurface className="w-full max-w-md p-5">
      {/* recipient */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-3.5">
        <MockAvatar initials="DO" color="orange" size={32} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white">David Osei</p>
          <p className="text-[10px] text-white/40">Coffee chat request</p>
        </div>
      </div>

      {/* message with resolved mail-merge */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="space-y-2 py-4 text-[12px] leading-relaxed text-white/70"
      >
        <p>
          Hi{' '}
          <span className="rounded bg-indigo-500/20 px-1 py-0.5 font-medium text-indigo-200">
            David
          </span>
          , it was great meeting you at{' '}
          <span className="rounded bg-violet-500/20 px-1 py-0.5 font-medium text-violet-200">
            the MIT Hackathon
          </span>
          .
        </p>
        <p className="text-white/50">
          I'd love to hear more about your work at Vanta — any chance you're free
          for a quick coffee?
        </p>
      </motion.div>

      {/* prep brief */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Coffee className="h-3.5 w-3.5 text-rose-300" />
          <span className="text-[11px] font-semibold text-white">Coffee chat prep</span>
        </div>
        <ul className="space-y-1.5">
          {BRIEF.map((line, i) => (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.35 + i * 0.1 }}
              className="flex items-start gap-2 text-[11px] text-white/55"
            >
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-rose-300/70" />
              {line}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </MockSurface>
  )
}
