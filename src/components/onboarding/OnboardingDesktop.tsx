import * as React from 'react'
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { useOnboardingFlow } from '@/components/onboarding/shared'
import { cn } from '@/lib/utils'

/**
 * The laptop's welcome screen: one question, then the app.
 *
 * Motion does the welcoming here, so the words don't have to. The screen
 * assembles itself in a deliberate order — mark, greeting, question, field —
 * the button wakes when there's a name to send, and submitting plays a short
 * hand-off ("Nice to meet you, Maya") while the name saves underneath, before
 * the card lifts away into the app where the tour picks up.
 *
 * Every animation is transform and opacity only, and MotionConfig hands the
 * whole screen over to the OS "reduce motion" setting.
 */

/** Springs, named for what they feel like. */
const SPRING = {
  settle: { type: 'spring', stiffness: 260, damping: 26 },
  snappy: { type: 'spring', stiffness: 420, damping: 30 },
  soft: { type: 'spring', stiffness: 140, damping: 22 },
} as const

/** How long the "nice to meet you" moment holds before the app appears. */
const HANDOFF_MS = 1400

const stage: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}

const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.settle },
}

export function OnboardingDesktop() {
  const { name, setName, mustName, ready, saving, submit, skip } = useOnboardingFlow()
  const [phase, setPhase] = React.useState<'ask' | 'handoff' | 'leaving'>('ask')
  const reduce = useReducedMotion()

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !mustName && phase === 'ask') skip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mustName, phase, skip])

  function send() {
    if (!ready || phase !== 'ask') return
    void submit(async () => {
      if (!name.trim()) return
      setPhase('handoff')
      await wait(reduce ? 500 : HANDOFF_MS)
      setPhase('leaving')
      await wait(reduce ? 0 : 420)
    })
  }

  const first = name.trim().split(/\s+/)[0] ?? ''

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-bg-sunken"
        animate={phase === 'leaving' ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <Ambient />

        <motion.header
          className="relative z-10 flex shrink-0 items-center justify-between gap-6 px-6 py-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.soft, delay: 0.05 }}
        >
          <Logo />
          {/* Only Sign in with Apple accounts may skip the name (nameRequired). */}
          {!mustName && phase === 'ask' && (
            <Button variant="ghost" size="sm" onClick={skip}>
              Skip
              <Kbd>Esc</Kbd>
            </Button>
          )}
        </motion.header>

        <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card/95 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={
              phase === 'leaving'
                ? { opacity: 0, y: -16, scale: 1.04 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            transition={phase === 'leaving' ? { duration: 0.4, ease: [0.4, 0, 1, 1] } : SPRING.settle}
            layout
          >
            <AnimatePresence mode="wait" initial={false}>
              {phase === 'ask' ? (
                <motion.form
                  key="ask"
                  onSubmit={(e) => {
                    e.preventDefault()
                    send()
                  }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.2 } }}
                >
                  <motion.div
                    className="px-10 pb-8 pt-12 text-center"
                    variants={stage}
                    initial="hidden"
                    animate="shown"
                  >
                    <Mark />
                    <h1 className="mt-6 text-3xl font-semibold leading-[1.1] tracking-[-0.03em]">
                      <Words text="Welcome to Retrn." />
                    </h1>
                    <motion.p variants={rise} className="mt-3 text-[15px] text-text-secondary">
                      What should we call you?
                    </motion.p>
                    <motion.div variants={rise} className="mx-auto mt-7 max-w-xs">
                      <NameField value={name} onChange={setName} />
                    </motion.div>
                  </motion.div>

                  <motion.div
                    className="flex items-center justify-end gap-4 border-t bg-bg-sunken/40 px-8 py-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55, duration: 0.3 }}
                  >
                    <motion.div
                      animate={ready ? { scale: 1, opacity: 1 } : { scale: 0.97, opacity: 0.55 }}
                      transition={SPRING.snappy}
                    >
                      <Button type="submit" disabled={!ready} className="group">
                        {saving ? (
                          <>
                            <Loader2 className="animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            Continue
                            <ArrowRight className="transition-transform duration-200 group-enabled:group-hover:translate-x-0.5" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </motion.form>
              ) : (
                <Handoff key="handoff" first={first} />
              )}
            </AnimatePresence>
          </motion.div>
        </main>
      </motion.div>
    </MotionConfig>
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** The app mark, arriving with a little weight. */
function Mark() {
  return (
    <motion.span
      variants={{
        hidden: { opacity: 0, scale: 0.6, rotate: -12 },
        shown: { opacity: 1, scale: 1, rotate: 0, transition: SPRING.snappy },
      }}
      className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-sm"
    >
      <span className="text-xl font-semibold leading-none">R</span>
    </motion.span>
  )
}

/** A line that rises in word by word. */
function Words({ text }: { text: string }) {
  return (
    <motion.span
      className="inline-block"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06 } } }}
      aria-label={text}
    >
      {text.split(' ').map((word, i) => (
        <motion.span key={i} variants={rise} className="mr-[0.25em] inline-block last:mr-0" aria-hidden>
          {word}
        </motion.span>
      ))}
    </motion.span>
  )
}

/** The name field, with a focus glow that grows rather than snaps. */
function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = React.useState(false)
  return (
    <div className="relative">
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[14px] bg-brand/15"
        initial={false}
        animate={focused ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
        transition={SPRING.snappy}
      />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Your name"
        aria-label="Your name"
        autoComplete="name"
        maxLength={80}
        className={cn(
          'relative h-12 w-full rounded-xl border bg-background px-4 text-center text-[16px] text-foreground',
          'placeholder:text-muted-foreground/80 transition-colors duration-150',
          'focus:border-brand focus:outline-none',
        )}
      />
    </div>
  )
}

/** "Nice to meet you" — a check that draws itself, then the line. */
function Handoff({ first }: { first: string }) {
  return (
    <motion.div
      className="flex flex-col items-center px-10 py-16 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.snappy}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.18, ease: [0.65, 0, 0.35, 1] }}
          />
        </svg>
      </motion.span>
      <motion.h2
        className="mt-6 text-2xl font-semibold tracking-[-0.02em]"
        initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...SPRING.settle, delay: 0.35 }}
      >
        Nice to meet you, {first}.
      </motion.h2>
      <motion.p
        className="mt-2 text-[15px] text-text-secondary"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING.settle, delay: 0.55 }}
      >
        Let’s show you around.
      </motion.p>
    </motion.div>
  )
}

/**
 * Two soft pools of the brand colour drifting behind the card — enough to
 * make the screen feel alive, too slow and faint to compete with it.
 */
function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand/[0.10] blur-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{
          opacity: { duration: 1.2 },
          x: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      <motion.div
        className="absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-sky-400/[0.08] blur-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{
          opacity: { duration: 1.4, delay: 0.2 },
          x: { duration: 20, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 16, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      {/* A faint dot grid, fading out toward the edges. */}
      <motion.div
        className="absolute inset-0 [background-image:radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.3 }}
      />
    </div>
  )
}

/** A keyboard hint, the way a desktop app labels its shortcuts. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none ml-1 rounded-sm border bg-bg-sunken px-1 font-mono text-[10px] leading-4 text-muted-foreground">
      {children}
    </kbd>
  )
}
