import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { FeatureSection } from '@/components/marketing/FeatureSection'
import { OrbitalGraphic } from '@/components/marketing/OrbitalGraphic'
import { PricingSection } from '@/components/marketing/PricingSection'
import { SectionDivider } from '@/components/marketing/SectionDivider'
import { DashboardMockup } from '@/components/marketing/mockups/DashboardMockup'
import { ContactsMockup } from '@/components/marketing/mockups/ContactsMockup'
import { PipelineMockup } from '@/components/marketing/mockups/PipelineMockup'
import { ComposeMockup } from '@/components/marketing/mockups/ComposeMockup'
import { ROUTES } from '@/lib/routes'

const EASE = [0.22, 1, 0.36, 1] as const

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: EASE },
}

/**
 * Public marketing site. One continuous near-black canvas — every hint of
 * color comes from large, soft, animated gradient glows layered over that
 * single base, so there are no section seams to blend and the whole page
 * reads as one cohesive surface. Product moments are live UI mockups (see
 * components/marketing/mockups), not screenshots, so it feels like the app
 * is actually running. Sign in / Get started both route to /login.
 */
export function LandingPage() {
  return (
    <div className="relative overflow-x-clip bg-[#07070b]">
      {/* Fine dot texture across the whole page, fading out lower down. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '30px 30px',
          maskImage:
            'linear-gradient(180deg, black 0%, black 30%, transparent 70%)',
        }}
      />

      <MarketingNav />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        {/* hero glows */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-14%] h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[130px]"
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[-8%] top-[24%] h-[420px] w-[420px] rounded-full bg-fuchsia-500/18 blur-[120px]"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-[-8%] top-[40%] h-[380px] w-[380px] rounded-full bg-sky-500/15 blur-[120px]"
          animate={{ opacity: [0.45, 0.8, 0.45] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Private by default — synced securely to your account
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
            className="mx-auto mt-7 max-w-3xl font-serif text-4xl font-medium leading-[1.05] tracking-tight text-white sm:text-6xl md:text-[4.25rem]"
          >
            Never lose track of
            <br />
            anyone you meet.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg"
          >
            Retrn is a personal CRM built for students — capture the people you
            meet at career fairs, coffee chats, and on the way to your gate,
            then turn those relationships into your next internship or job.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.28, ease: EASE }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to={ROUTES.login}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)]"
            >
              Get Retrn free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="text-xs text-white/40">
              Free, forever — takes about ten seconds
            </span>
          </motion.div>

          {/* Live dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: EASE }}
            className="mx-auto mt-12 w-full max-w-xl sm:mt-16"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </section>

      {/* ================= "EVERYWHERE" BEAT ================= */}
      <section className="relative overflow-hidden py-12 sm:py-20">
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.p
            {...fadeUp}
            className="text-xs font-semibold uppercase tracking-wider text-indigo-300"
          >
            Capture, everywhere
          </motion.p>
          <motion.h2
            {...fadeUp}
            className="mt-3 font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl"
          >
            People don't wait for LinkedIn.
          </motion.h2>
          <motion.p
            {...fadeUp}
            className="mx-auto mt-4 max-w-md text-base text-white/55"
          >
            You meet them on a bus, at a bar, backstage. Retrn doesn't care
            where — it just remembers.
          </motion.p>
        </div>

        {/* The orbital is a fixed 560px system; scale + clip it so it doesn't
            leave a huge empty square on small screens. */}
        <div className="relative mt-2 flex h-[360px] justify-center overflow-hidden sm:mt-6 sm:h-[560px]">
          <div className="origin-top scale-[0.6] sm:scale-100">
            <OrbitalGraphic />
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section
        id="features"
        className="relative mx-auto max-w-6xl space-y-20 px-4 pb-20 pt-2 sm:space-y-36 sm:px-6 sm:pb-36 sm:pt-4"
      >
        {/* soft moving accent glows behind the feature stack */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-[-10%] top-[6%] h-[440px] w-[440px] rounded-full bg-violet-600/12 blur-[130px]"
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-[-10%] top-[55%] h-[440px] w-[440px] rounded-full bg-rose-600/12 blur-[130px]"
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <FeatureSection
          index={1}
          eyebrow="Capture"
          title="Add anyone in seconds, from anywhere"
          description="A name and how you met is enough to save. Paste a LinkedIn profile to auto-fill the rest, tag where you met them, and Retrn takes care of the details — just as fast from your phone as your laptop."
          accent="indigo"
          visual={<ContactsMockup />}
        />
        <FeatureSection
          index={2}
          eyebrow="Pipeline"
          title="Turn your network into your next offer"
          description="Track every internship and job you're chasing on a simple board, and see exactly who in your network can put in a good word — recruiters, referrers, and warm intros, all linked to the opportunity."
          accent="violet"
          reverse
          visual={<PipelineMockup />}
        />
        <FeatureSection
          index={3}
          eyebrow="Follow through"
          title="Never show up to a conversation cold"
          description="Get a quick brief before every coffee chat — talking points, your last conversation, shared history. Reusable outreach templates make the follow-up just as easy."
          accent="rose"
          visual={<ComposeMockup />}
        />
      </section>

      {/* ================= PRICING ================= */}
      <SectionDivider />
      <PricingSection />

      <SectionDivider />

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden py-20 text-center sm:py-32">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/22 blur-[130px]"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
          <motion.h2
            {...fadeUp}
            className="font-serif text-3xl font-medium tracking-tight text-white sm:text-5xl"
          >
            Start building your network today.
          </motion.h2>
          <motion.p {...fadeUp} className="mt-4 text-base text-white/55">
            It takes ten seconds to add your first contact.
          </motion.p>
          <motion.div {...fadeUp}>
            <Link
              to={ROUTES.login}
              className="group mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)]"
            >
              Get Retrn free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      <MarketingFooter />
    </div>
  )
}
