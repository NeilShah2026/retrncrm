import * as React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check, PartyPopper } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

const EASE = [0.22, 1, 0.36, 1] as const

type Billing = 'monthly' | 'yearly'

interface Tier {
  name: string
  badge?: string
  featured?: boolean
  price: (b: Billing) => { amount: string; period?: string; note?: string }
  subhead: string
  featuresLead?: string
  features: string[]
  cta: string
  ctaMicro?: string
  href: string
  external?: boolean
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: () => ({ amount: '$0', period: 'forever' }),
    subhead: 'Start building your network today',
    features: [
      'Up to 30 contacts',
      'Manual contact capture (name, company, how you met, notes)',
      'Tags & filters',
      'Last-contact tracking',
      'Dashboard overview',
      'Private & synced to your account',
    ],
    cta: 'Get started free',
    href: ROUTES.login,
  },
  {
    name: 'Student',
    badge: 'Most popular',
    featured: true,
    price: (b) =>
      b === 'monthly'
        ? { amount: '$5', period: '/mo' }
        : { amount: '$50', period: '/yr', note: 'billed yearly' },
    subhead: 'Verify your .edu email to unlock everything',
    featuresLead: 'Everything in Free, plus:',
    features: [
      'Unlimited contacts',
      'Photo/business card capture (OCR)',
      'Voice-to-contact quick add',
      'Recruiting pipeline stages (coffee chat → applied → interview → offer)',
      'Reconnect suggestions & smart reminders',
      'CSV/JSON export',
    ],
    cta: 'Verify .edu',
    ctaMicro: 'Save 67% off Standard — just confirm your school email',
    href: `${ROUTES.login}?plan=student`,
  },
  {
    name: 'Standard',
    price: (b) =>
      b === 'monthly'
        ? { amount: '$15', period: '/mo' }
        : { amount: '$150', period: '/yr', note: 'billed yearly' },
    subhead: 'For professionals building their network',
    featuresLead: 'Everything in Free, plus:',
    features: [
      'Unlimited contacts',
      'Photo/business card capture (OCR)',
      'Voice-to-contact quick add',
      'Pipeline stages & custom statuses',
      'Reconnect suggestions & smart reminders',
      'CSV/JSON export',
    ],
    cta: 'Get started',
    href: `${ROUTES.login}?plan=standard`,
  },
  {
    name: 'Groups & Institutions',
    price: () => ({ amount: 'Custom' }),
    subhead: 'For colleges, clubs, and career centers',
    features: [
      'Everything in Standard, for every member',
      'Bulk seat licensing',
      'Admin dashboard (optional, future)',
      'Onboarding support for your org',
    ],
    cta: 'Contact us',
    href: 'mailto:hello@retrn.app',
    external: true,
  },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
}

export function PricingSection() {
  const [billing, setBilling] = React.useState<Billing>('monthly')

  return (
    <div id="pricing" className="relative overflow-hidden py-20 sm:py-32">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[380px] w-[620px] -translate-x-1/2 rounded-full bg-indigo-600/12 blur-[130px]"
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Founding offer */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto mb-10 flex max-w-xl items-center justify-center gap-2.5 rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-400/10 via-rose-400/10 to-indigo-500/10 px-4 py-3 text-center text-sm text-white/85"
        >
          <PartyPopper className="h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <span className="font-semibold text-white">Founding offer:</span>{' '}
            join before <span className="font-semibold text-white">August 31, 2026</span>{' '}
            and Retrn is <span className="font-semibold text-white">free for life</span>.
          </span>
        </motion.div>

        {/* Heading */}
        <div className="text-center">
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.5, ease: EASE }}
            className="text-xs font-semibold uppercase tracking-wider text-rose-300"
          >
            Pricing
          </motion.p>
          <motion.h2
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
            className="mt-3 font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl"
          >
            Start free. Upgrade when you're ready.
          </motion.h2>
        </div>

        {/* Billing toggle */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(['monthly', 'yearly'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={cn(
                  'relative rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                  billing === b ? 'text-black' : 'text-white/60 hover:text-white',
                )}
              >
                {billing === b && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 rounded-full bg-white"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{b}</span>
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-emerald-300 sm:inline">
            2 months free with yearly
          </span>
        </motion.div>

        {/* Cards */}
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} billing={billing} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PricingCard({
  tier,
  billing,
  index,
}: {
  tier: Tier
  billing: Billing
  index: number
}) {
  const price = tier.price(billing)

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: EASE }}
      className={cn(
        'relative flex flex-col rounded-2xl border p-6',
        tier.featured
          ? 'border-indigo-400/40 bg-indigo-500/[0.07] shadow-[0_30px_80px_-30px_rgba(99,102,241,0.5)] xl:-translate-y-3'
          : 'border-white/10 bg-white/[0.02]',
      )}
    >
      {tier.featured && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent"
        />
      )}

      {tier.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-500 px-3 py-1 text-[11px] font-semibold text-white shadow-lg">
          {tier.badge}
        </span>
      )}

      <div className="mb-1 mt-2 text-sm font-semibold text-white">{tier.name}</div>

      <div className="flex items-baseline gap-1">
        <span className="font-serif text-4xl font-medium text-white">{price.amount}</span>
        {price.period && (
          <span className="text-sm text-white/50">{price.period}</span>
        )}
      </div>
      <div className="mt-1 h-4 text-xs text-white/40">{price.note ?? ''}</div>

      <p className="mt-3 min-h-[2.5rem] text-sm leading-snug text-white/55">
        {tier.subhead}
      </p>

      {tier.external ? (
        <a
          href={tier.href}
          className={cn(
            'mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.02]',
            'border border-white/15 text-white hover:bg-white/[0.06]',
          )}
        >
          {tier.cta}
        </a>
      ) : (
        <Link
          to={tier.href}
          className={cn(
            'mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.02]',
            tier.featured
              ? 'bg-white text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]'
              : 'border border-white/15 text-white hover:bg-white/[0.06]',
          )}
        >
          {tier.cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      {tier.ctaMicro && (
        <p className="mt-2 text-center text-[11px] leading-snug text-indigo-200/70">
          {tier.ctaMicro}
        </p>
      )}

      <div className="mt-6 space-y-2.5 border-t border-white/[0.08] pt-6">
        {tier.featuresLead && (
          <p className="text-xs font-medium text-white/70">{tier.featuresLead}</p>
        )}
        {tier.features.map((f) => (
          <div key={f} className="flex items-start gap-2.5">
            <Check
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                tier.featured ? 'text-indigo-300' : 'text-emerald-400/80',
              )}
            />
            <span className="text-sm leading-snug text-white/70">{f}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
