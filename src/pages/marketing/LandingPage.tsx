import { Link } from 'react-router-dom'
import { ArrowRight, Puzzle } from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { FeatureSection } from '@/components/marketing/FeatureSection'
import { PricingSection } from '@/components/marketing/PricingSection'
import { DashboardMockup } from '@/components/marketing/mockups/DashboardMockup'
import { ContactsMockup } from '@/components/marketing/mockups/ContactsMockup'
import { PipelineMockup } from '@/components/marketing/mockups/PipelineMockup'
import { ComposeMockup } from '@/components/marketing/mockups/ComposeMockup'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { CHROME_STORE_URL } from '@/lib/constants'

/** Where students actually meet people. Specific beats generic. */
const MOMENTS = [
  {
    n: '01',
    title: 'The career fair',
    body: 'Forty conversations, forty business cards, one that matters. Type their name and the booth before you reach the next table.',
  },
  {
    n: '02',
    title: 'The coffee chat',
    body: 'Set a cadence — every quarter, say — and Retrn tells you when it has been too long, with a prep brief before you write.',
  },
  {
    n: '03',
    title: 'The flight home',
    body: 'Seat 14C turns out to run recruiting at a firm you like. That is a contact, not a story you forget by Thanksgiving.',
  },
]

/**
 * Public marketing site. Same tokens as the app: an off-white canvas,
 * hairlines, one near-black action colour, no ambient gradients. Product
 * moments are live mockups built from the app's own primitives, labelled as
 * examples.
 */
export function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <MarketingNav />

      {/* ---- Hero: left-weighted copy, product on the right ---- */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pb-24 lg:pt-20">
        <div className="max-w-xl">
          <p className="text-label text-muted-foreground">Personal CRM for students</p>
          <h1 className="text-display mt-4 text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem]">
            Never lose track of anyone you meet.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-text-secondary sm:text-lg">
            Capture the people you meet at career fairs, coffee chats and on the way to
            your gate. Follow up on time. Turn the relationships into your next
            internship or job.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to={ROUTES.login}>
                Get Retrn free
                <ArrowRight />
              </Link>
            </Button>
            <a
              href="#features"
              className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-foreground hover:underline"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free for up to 30 contacts. Free for Babson students entirely.
          </p>
        </div>

        <div className="relative">
          <DashboardMockup />
          <p className="mt-2 text-right text-xs text-muted-foreground">Example data</p>
        </div>
      </section>

      {/* ---- Where people actually meet: a numbered editorial list ---- */}
      <section className="border-y bg-bg-sunken/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-xl">
            <p className="text-label text-muted-foreground">Capture, wherever it happens</p>
            <h2 className="text-display mt-3 text-3xl sm:text-4xl">People don’t wait for LinkedIn.</h2>
          </div>
          <ol className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
            {MOMENTS.map((m) => (
              <li key={m.n} className="bg-background p-6">
                <span className="tnum text-xs font-medium text-muted-foreground">{m.n}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-[-0.01em]">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Features: one lead, two supporting ---- */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <FeatureSection
          index={1}
          lead
          eyebrow="Capture"
          title="Add anyone in one line"
          description="Type who you met — “Sarah Chen, PM at Fidelity, career fair, follow up in a month” — and Retrn structures it into a contact. Paste a LinkedIn profile to fill the rest. A name and where you met is enough to save."
          visual={<ContactsMockup />}
        />
        <div className="mt-16 grid grid-cols-1 gap-16 lg:mt-20 lg:grid-cols-2 lg:gap-12">
          <FeatureSection
            index={2}
            eyebrow="Pipeline"
            title="Turn the network into offers"
            description="Every internship and job on one board, with the recruiters, referrers and warm intros linked to the opportunity they can help with."
            visual={<PipelineMockup />}
          />
          <FeatureSection
            index={3}
            eyebrow="Follow through"
            title="Never show up cold"
            description="A short brief before each conversation — what you talked about last, what to ask — and outreach templates that fill in from the person’s record."
            visual={<ComposeMockup />}
          />
        </div>
      </section>

      {/* ---- Extension: a quiet row, not a glowing card ---- */}
      <section className="border-y">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-bg-sunken text-text-secondary">
              <Puzzle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em]">A browser extension for your inbox</h2>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-text-secondary">
                Log emails from Gmail and Outlook, and add people from LinkedIn, to the right
                Retrn contact without leaving the tab.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer">
              Add to Chrome
              <ArrowRight />
            </a>
          </Button>
        </div>
      </section>

      <PricingSection />

      {/* ---- Final CTA ---- */}
      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <div>
            <h2 className="text-display text-3xl sm:text-4xl">Start with the next person you meet.</h2>
            <p className="mt-2 text-base text-text-secondary">
              It takes about ten seconds to add your first contact.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link to={ROUTES.login}>
              Get Retrn free
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
