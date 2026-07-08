import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

const CHIPS = [
  'Unlimited contacts',
  'Recruiting pipeline',
  'Outreach templates',
  'Synced everywhere',
  'Full data export',
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
}

/**
 * Pricing as an editorial statement, not a SaaS pricing-card template: the
 * price itself is the headline, everything else is supporting detail.
 */
export function PricingSection() {
  return (
    <div id="pricing" className="relative py-28 sm:py-36">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-[120px]"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-wider text-rose-300"
        >
          Pricing
        </motion.p>

        <motion.h2
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-4 font-serif text-5xl font-medium tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          Free. Forever.
          <br />
          No catch.
        </motion.h2>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/55"
        >
          Built by a student, for students — no seat licenses, no sales
          team, nothing to upsell you on. Everything is included, for as
          long as you need it.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-2"
        >
          {CHIPS.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/60"
            >
              {chip}
            </span>
          ))}
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.24 }}
        >
          <Link
            to={ROUTES.login}
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
          >
            Get started — it's free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
