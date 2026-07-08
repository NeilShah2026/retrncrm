import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { BrowserFrame } from '@/components/marketing/BrowserFrame'
import { FeatureSection } from '@/components/marketing/FeatureSection'
import { OrbitalGraphic } from '@/components/marketing/OrbitalGraphic'
import { PricingSection } from '@/components/marketing/PricingSection'
import { ROUTES } from '@/lib/routes'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: 'easeOut' as const },
}

/**
 * Public marketing site. Deliberately self-contained: fixed styling
 * regardless of the app's light/dark toggle, no data dependency — this route
 * has to load instantly for a first-time visitor. Sign in / Get started
 * both route to /login.
 */
export function LandingPage() {
  return (
    <div className="overflow-x-clip bg-[#08080c]">
      {/* ============ HERO (dark) ============ */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, #08080c 0%, #0a0810 55%, #1c1420 75%, #4a3536 88%, #f6ecdd 100%)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(180deg, black 0%, black 60%, transparent 100%)',
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-10%] h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[120px]"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[-10%] top-[20%] h-[360px] w-[360px] rounded-full bg-fuchsia-500/20 blur-[110px]"
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-[35%] h-[320px] w-[320px] rounded-full bg-sky-500/20 blur-[110px]"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <MarketingNav />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-32 pt-16 text-center sm:px-6 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/70"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Private by default — synced securely to your account
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mx-auto mt-6 max-w-3xl font-serif text-4xl font-medium tracking-tight text-white sm:text-5xl md:text-6xl"
          >
            Never lose track of anyone you meet.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg"
          >
            Retrn is a personal CRM built for students — capture the people you
            meet at career fairs, coffee chats, and on the way to your gate,
            then turn those relationships into your next internship or job.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to={ROUTES.login}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Get Retrn free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-white/40">
              Free, forever — takes about ten seconds
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            whileHover={{ y: -4 }}
            className="mx-auto mt-16 w-full max-w-5xl"
          >
            <BrowserFrame
              src="/marketing/hero-dashboard.png"
              alt="Retrn dashboard showing reconnect suggestions and pipeline snapshot"
            />
          </motion.div>
        </div>
      </div>

      {/* ============ LIGHT feature section ============ */}
      <div className="relative bg-[#f6ecdd]">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-20 sm:px-6 sm:pb-14 sm:pt-28" id="features">
          <FeatureSection
            index={1}
            eyebrow="Capture"
            title="Add anyone in seconds, from anywhere"
            description="A name and how you met is enough to save. Paste a LinkedIn profile to auto-fill the rest, tag where you met them — career fair, guest lecture, hackathon, coffee chat — and Retrn takes care of the rest. Works just as fast from your phone as your laptop."
            images={[
              { src: '/marketing/feature-contacts-phone.png', alt: 'Retrn contacts list on a phone' },
            ]}
            frame="phone"
          />
        </div>
      </div>

      {/* ============ WARM → DARK sweep: orbital, pipeline, network, follow-through ============ */}
      <div
        className="relative"
        style={{
          background:
            'linear-gradient(180deg, #f6ecdd 0%, #f1d9bd 8%, #e8bfab 18%, #d99fac 30%, #b979a8 42%, #8c5fa0 54%, #5f4788 66%, #362d5e 78%, #17132a 90%, #0a0810 100%)',
        }}
      >
        <div className="mx-auto max-w-3xl px-4 pt-12 text-center sm:px-6 sm:pt-16">
          <motion.p
            {...fadeUp}
            className="text-xs font-semibold uppercase tracking-wider text-zinc-700"
          >
            Capture, everywhere
          </motion.p>
          <motion.h2
            {...fadeUp}
            className="mt-3 font-serif text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl"
          >
            People don't wait for LinkedIn.
          </motion.h2>
          <motion.p {...fadeUp} className="mx-auto mt-4 max-w-md text-base text-zinc-700">
            You meet them on a bus, at a bar, backstage. Retrn doesn't care
            where — it just remembers.
          </motion.p>
        </div>

        <div className="px-4 py-14 sm:px-6">
          <OrbitalGraphic light />
        </div>

        <div className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-4 sm:space-y-10 sm:px-6 sm:pb-28">
          <FeatureSection
            index={2}
            eyebrow="Pipeline"
            title="Turn your network into your next offer"
            description="Track every internship and job you're chasing on a simple board, and see exactly who in your network can put in a good word — recruiters, referrers, and warm intros, all linked to the opportunity."
            images={[
              { src: '/marketing/feature-pipeline.png', alt: 'Retrn recruiting pipeline board with companies organized by stage' },
              { src: '/marketing/feature-pipeline-2.png', alt: 'Editing an opportunity on the Retrn pipeline board' },
            ]}
            accent="violet"
            reverse
          />
          <FeatureSection
            index={3}
            eyebrow="Follow through"
            title="Never show up to a conversation cold"
            description="Get a quick brief before every coffee chat — talking points, your last conversation, shared history. Reusable outreach templates make the follow-up just as easy."
            images={[
              { src: '/marketing/feature-templates.png', alt: 'Retrn outreach templates ready to compose and send' },
              { src: '/marketing/feature-templates-2.png', alt: 'Composing a mail-merged message from a Retrn template' },
            ]}
            accent="rose"
          />
        </div>
      </div>

      {/* ============ BLACK: pricing, final CTA, footer ============ */}
      <div className="relative bg-[#08080c]">
        <PricingSection />

        <div className="relative overflow-hidden py-24 text-center sm:py-32">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/25 blur-[130px]"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
            <motion.h2
              {...fadeUp}
              className="font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl"
            >
              Start building your network today.
            </motion.h2>
            <motion.p {...fadeUp} className="mt-4 text-base text-white/60">
              It takes ten seconds to add your first contact.
            </motion.p>
            <motion.div {...fadeUp}>
              <Link
                to={ROUTES.login}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
              >
                Get Retrn free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>

        <MarketingFooter />
      </div>
    </div>
  )
}
