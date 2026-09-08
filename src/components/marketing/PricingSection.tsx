import * as React from 'react'
import { Link } from 'react-router-dom'
import { Check, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Billing = 'monthly' | 'yearly'

interface Tier {
  name: string
  recommended?: boolean
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
      'Manual capture: name, company, how you met, notes',
      'Tags and filters',
      'Last-contact tracking',
      'Dashboard overview',
      'Private and synced to your account',
    ],
    cta: 'Get started free',
    href: ROUTES.login,
  },
  {
    name: 'Student',
    recommended: true,
    price: (b) =>
      b === 'monthly'
        ? { amount: '$5', period: '/mo' }
        : { amount: '$50', period: '/yr', note: 'billed yearly' },
    subhead: 'Verify a .edu email for everything',
    featuresLead: 'Everything in Free, plus',
    features: [
      'Unlimited contacts',
      'Photo and business-card capture',
      'One-line capture, typed or spoken',
      'Recruiting pipeline: coffee chat → applied → interview → offer',
      'Reconnect suggestions and reminders',
      'CSV and JSON export',
    ],
    cta: 'Verify .edu',
    ctaMicro: 'Free for Babson students with a verified @babson.edu email',
    href: `${ROUTES.login}?plan=student`,
  },
  {
    name: 'Standard',
    price: (b) =>
      b === 'monthly'
        ? { amount: '$15', period: '/mo' }
        : { amount: '$150', period: '/yr', note: 'billed yearly' },
    subhead: 'For professionals building a network',
    featuresLead: 'Everything in Free, plus',
    features: [
      'Unlimited contacts',
      'Photo and business-card capture',
      'One-line capture, typed or spoken',
      'Pipeline stages and custom statuses',
      'Reconnect suggestions and reminders',
      'CSV and JSON export',
    ],
    cta: 'Get started',
    href: `${ROUTES.login}?plan=standard`,
  },
  {
    name: 'Groups & institutions',
    price: () => ({ amount: 'Custom' }),
    subhead: 'For colleges, clubs and career centers',
    features: [
      'Everything in Standard, for every member',
      'Bulk seat licensing',
      'Admin dashboard (planned)',
      'Onboarding support for your org',
    ],
    cta: 'Contact us',
    href: 'mailto:hello@retrncrm.com',
    external: true,
  },
]

/**
 * Four tiers in one hairline grid. The recommended plan gets the primary
 * button and a label — nothing else is louder than anything else.
 */
export function PricingSection() {
  const [billing, setBilling] = React.useState<Billing>('monthly')

  return (
    <section id="pricing" className="border-t bg-bg-sunken/50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-label text-muted-foreground">Pricing</p>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl">Start free. Upgrade when you’re ready.</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-8 items-center rounded-md border bg-background p-0.5" role="group" aria-label="Billing period">
              {(['monthly', 'yearly'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  aria-pressed={billing === b}
                  className={cn(
                    'h-full rounded-sm px-3 text-xs font-medium capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    billing === b ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Two months free yearly</span>
          </div>
        </div>

        <p className="mt-8 flex items-start gap-2 text-sm text-text-secondary">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-medium text-foreground">Babson students:</span> a verified
            @babson.edu email gets every paid feature free, no card.
          </span>
        </p>

        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier) => (
            <PricingCard key={tier.name} tier={tier} billing={billing} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingCard({ tier, billing }: { tier: Tier; billing: Billing }) {
  const price = tier.price(billing)

  return (
    <div className="flex flex-col bg-background p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{tier.name}</h3>
        {tier.recommended && (
          <span className="rounded-sm border px-1.5 py-px text-xs font-medium text-text-secondary">
            Recommended
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="tnum text-3xl font-semibold tracking-[-0.02em]">{price.amount}</span>
        {price.period && <span className="text-sm text-muted-foreground">{price.period}</span>}
      </div>
      <div className="mt-1 h-4 text-xs text-muted-foreground">{price.note ?? ''}</div>

      <p className="mt-3 min-h-[2.5rem] text-sm leading-snug text-text-secondary">{tier.subhead}</p>

      <Button variant={tier.recommended ? 'default' : 'outline'} asChild className="mt-5 w-full">
        {tier.external ? <a href={tier.href}>{tier.cta}</a> : <Link to={tier.href}>{tier.cta}</Link>}
      </Button>

      {tier.ctaMicro && (
        <p className="mt-2 text-center text-xs leading-snug text-muted-foreground">{tier.ctaMicro}</p>
      )}

      <ul className="mt-6 space-y-2 border-t pt-5">
        {tier.featuresLead && (
          <li className="text-xs font-medium text-text-secondary">{tier.featuresLead}</li>
        )}
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm leading-snug text-text-secondary">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
