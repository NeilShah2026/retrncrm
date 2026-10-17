import * as React from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/useIsMobile'
import { track } from '@/lib/analytics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { TOUR_STEPS, type TourPlacement, type TourStep } from './tourSteps'

/**
 * The first-run tooltip walkthrough.
 *
 * Starts after the name screen (the welcome route hands over with
 * `{ state: { tour: true } }`) or from Settings → Take the tour. Each step
 * opens its page, waits for its element to appear, dims everything else and
 * points at it. Laptop only: the phone has its own, smaller screens.
 */

interface TourContextValue {
  start: () => void
  active: boolean
}

const TourContext = React.createContext<TourContextValue>({ start: () => {}, active: false })

export function useTour(): TourContextValue {
  return React.useContext(TourContext)
}

/** Navigation state that starts the tour on arrival. */
export const START_TOUR_STATE = { tour: true } as const

/** How long to wait for a step's element after navigating before skipping it. */
const FIND_TIMEOUT_MS = 6000

export function TourProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const [index, setIndex] = React.useState<number | null>(null)
  /** Optional steps whose element never showed up this run. */
  const [skipped, setSkipped] = React.useState<Set<string>>(new Set())

  const steps = TOUR_STEPS.filter((s) => !skipped.has(s.id))
  const step = index === null ? null : steps[index]

  const start = React.useCallback(() => {
    if (isMobile) return
    setSkipped(new Set())
    setIndex(0)
    track('tour_started')
  }, [isMobile])

  // Arriving from the welcome screen.
  React.useEffect(() => {
    const state = location.state as { tour?: boolean } | null
    if (!state?.tour) return
    navigate(location.pathname, { replace: true, state: null })
    start()
  }, [location.state, location.pathname, navigate, start])

  // Each step happens on its own page — navigated to once per step, so a
  // page that redirects elsewhere can't bounce the tour back and forth.
  const navigatedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!step) {
      navigatedFor.current = null
      return
    }
    if (navigatedFor.current === step.id) return
    navigatedFor.current = step.id
    // A feature this account doesn't have (its sidebar item isn't there) is
    // left out before going anywhere.
    if (step.optional && !document.querySelector(`[data-tour="${step.target}"]`)) {
      setSkipped((s) => new Set(s).add(step.id))
      return
    }
    if (location.pathname !== step.route) navigate(step.route)
  }, [step, location.pathname, navigate])

  const close = React.useCallback(
    (completed: boolean) => {
      if (index !== null) {
        track(completed ? 'tour_completed' : 'tour_skipped', { step: steps[index]?.id ?? 'unknown' })
      }
      setIndex(null)
      if (completed) navigate(ROUTES.dashboard)
    },
    [index, navigate, steps],
  )

  const next = React.useCallback(() => {
    if (index === null) return
    if (index >= steps.length - 1) close(true)
    else setIndex(index + 1)
  }, [close, index, steps.length])

  const back = React.useCallback(() => {
    setIndex((i) => (i === null || i === 0 ? i : i - 1))
  }, [])

  const missing = React.useCallback(() => {
    if (!step) return
    // A feature that isn't on this account (Cold email off) is left out
    // quietly; anything else that can't be found just moves on.
    if (step.optional) setSkipped((s) => new Set(s).add(step.id))
    else next()
  }, [next, step])

  const value = React.useMemo(() => ({ start, active: index !== null }), [start, index])

  return (
    <TourContext.Provider value={value}>
      {children}
      {createPortal(
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {/* One overlay for the whole tour, so the spotlight and the card
                travel between steps instead of blinking out and back. */}
            {step && index !== null && (
              <TourOverlay
                key="tour"
                step={step}
                index={index}
                total={steps.length}
                onNext={next}
                onBack={back}
                onClose={() => close(false)}
                onMissing={missing}
              />
            )}
          </AnimatePresence>
        </MotionConfig>,
        document.body,
      )}
    </TourContext.Provider>
  )
}

// ---------------------------------------------------------------------------

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6
const GAP = 14
const MARGIN = 12

function sameBox(a: Box | null, b: Box): boolean {
  return (
    !!a &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

/** Where the card goes: the preferred side if it fits, else the roomiest. */
function placeCard(
  target: Box,
  card: { width: number; height: number },
  preferred: TourPlacement,
): { top: number; left: number; side: TourPlacement } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const room: Record<TourPlacement, number> = {
    right: vw - (target.left + target.width) - GAP,
    left: target.left - GAP,
    bottom: vh - (target.top + target.height) - GAP,
    top: target.top - GAP,
  }
  const need: Record<TourPlacement, number> = {
    right: card.width + MARGIN,
    left: card.width + MARGIN,
    bottom: card.height + MARGIN,
    top: card.height + MARGIN,
  }
  const order: TourPlacement[] = [preferred, 'bottom', 'right', 'left', 'top']
  const side = order.find((p) => room[p] >= need[p]) ?? order.sort((a, b) => room[b] - room[a])[0]

  const clamp = (v: number, max: number) => Math.min(Math.max(v, MARGIN), max - MARGIN)
  let top: number
  let left: number
  if (side === 'right' || side === 'left') {
    left = side === 'right' ? target.left + target.width + GAP : target.left - GAP - card.width
    top = clamp(target.top + target.height / 2 - card.height / 2, vh - card.height)
  } else {
    top = side === 'bottom' ? target.top + target.height + GAP : target.top - GAP - card.height
    left = clamp(target.left + target.width / 2 - card.width / 2, vw - card.width)
  }
  return { top, left, side }
}


/** Springs for the tour: the spotlight glides, the card follows a beat behind. */
const GLIDE = { type: 'spring', stiffness: 210, damping: 28, mass: 0.9 } as const
const FOLLOW = { type: 'spring', stiffness: 240, damping: 30, mass: 1 } as const
const CARD_WIDTH = 320
const DIM = 'rgba(10, 12, 18, 0.58)'

const ARROW_CLASS: Record<TourPlacement, string> = {
  right: 'border-b border-l',
  left: 'border-r border-t',
  bottom: 'border-l border-t',
  top: 'border-b border-r',
}

const slide = {
  enter: (dir: number) => ({ x: dir * 24, opacity: 0, filter: 'blur(4px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: dir * -24, opacity: 0, filter: 'blur(4px)' }),
}

const tick = {
  enter: (dir: number) => ({ y: dir * 10, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -10, opacity: 0 }),
}

function TourOverlay({
  step,
  index,
  total,
  onNext,
  onBack,
  onClose,
  onMissing,
}: {
  step: TourStep
  index: number
  total: number
  onNext: () => void
  onBack: () => void
  onClose: () => void
  onMissing: () => void
}) {
  const [box, setBox] = React.useState<Box | null>(null)
  const [contentHeight, setContentHeight] = React.useState(180)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const onMissingRef = React.useRef(onMissing)
  onMissingRef.current = onMissing

  // Which way the words slide: forward from the right, back from the left.
  const previous = React.useRef(index)
  const direction = React.useRef(1)
  if (previous.current !== index) {
    direction.current = index > previous.current ? 1 : -1
    previous.current = index
  }
  const d = direction.current

  // Find this step's element (its page may still be loading), then follow
  // it. The last step's box stays put until the new one is found, so the
  // spotlight travels from one to the other rather than vanishing.
  React.useEffect(() => {
    let frame = 0
    let found = false
    const startedAt = performance.now()
    const loop = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      const r = el?.getBoundingClientRect()
      if (el && r && r.width > 0 && r.height > 0) {
        if (!found) {
          found = true
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
        const next = { top: r.top, left: r.left, width: r.width, height: r.height }
        setBox((prev) => (sameBox(prev, next) ? prev : next))
      } else if (!found && performance.now() - startedAt > FIND_TIMEOUT_MS) {
        onMissingRef.current()
        return
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [step.target])

  const hasBox = box !== null

  // The card's height follows its words, animated rather than snapped.
  React.useLayoutEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setContentHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasBox])

  React.useEffect(() => {
    if (hasBox) cardRef.current?.focus({ preventScroll: true })
  }, [hasBox])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        onNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack, onClose, onNext])

  const hole = box && {
    top: box.top - PAD,
    left: box.left - PAD,
    width: box.width + PAD * 2,
    height: box.height + PAD * 2,
  }
  const cardSize = { width: CARD_WIDTH, height: contentHeight + 2 }
  const placed = hole ? placeCard(hole, cardSize, step.placement) : null
  const last = index === total - 1

  // The arrow sits on the card's edge, opposite the middle of the target.
  let arrow: { top: number; left: number } | null = null
  if (hole && placed) {
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 14), max - 26)
    arrow =
      placed.side === 'right' || placed.side === 'left'
        ? {
            top: clamp(hole.top + hole.height / 2 - placed.top - 6, cardSize.height),
            left: placed.side === 'right' ? -6 : CARD_WIDTH - 7,
          }
        : {
            top: placed.side === 'bottom' ? -6 : cardSize.height - 7,
            left: clamp(hole.left + hole.width / 2 - placed.left - 6, CARD_WIDTH),
          }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
    >
      {/* Blocks clicks on the page while the tour is up; the tour drives. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* A plain dim until the first element is found; after that the
          spotlight's own shadow is the dim, and the two cross-fade. */}
      <AnimatePresence>
        {!hole && (
          <motion.div
            key="dim"
            aria-hidden
            className="absolute inset-0"
            style={{ background: DIM }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          />
        )}
      </AnimatePresence>

      {hole && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute rounded-[12px] ring-2 ring-brand/70"
            style={{ boxShadow: `0 0 0 9999px ${DIM}` }}
            initial={{
              opacity: 0,
              top: hole.top - 28,
              left: hole.left - 28,
              width: hole.width + 56,
              height: hole.height + 56,
            }}
            animate={{ opacity: 1, ...hole }}
            transition={{ ...GLIDE, opacity: { duration: 0.3 } }}
          />
          {/* A ring that ripples out once when the spotlight lands. */}
          <motion.div
            key={`pulse-${step.id}`}
            aria-hidden
            className="pointer-events-none absolute rounded-[14px] ring-2 ring-brand"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.7, 0], scale: [1, 1, 1.12] }}
            transition={{ duration: 1.1, delay: 0.35, ease: [0.2, 0, 0, 1], times: [0, 0.15, 1] }}
          />
        </>
      )}

      {placed && (
        <motion.div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          tabIndex={-1}
          className="absolute outline-none"
          style={{ width: CARD_WIDTH }}
          initial={{ opacity: 0, scale: 0.94, top: placed.top + 8, left: placed.left }}
          animate={{ opacity: 1, scale: 1, top: placed.top, left: placed.left }}
          transition={{ ...FOLLOW, opacity: { duration: 0.25, delay: 0.1 } }}
        >
          {arrow && (
            <motion.span
              aria-hidden
              className={cn('absolute z-10 h-3 w-3 rotate-45 bg-card', ARROW_CLASS[placed.side])}
              initial={false}
              animate={arrow}
              transition={FOLLOW}
            />
          )}

          <motion.div
            className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-[0_18px_50px_-20px_rgba(10,12,18,0.55)]"
            initial={false}
            animate={{ height: cardSize.height }}
            transition={FOLLOW}
          >
            <div ref={contentRef} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="tnum flex text-xs font-medium text-brand">
                  Step&nbsp;
                  <span className="relative inline-block overflow-hidden">
                    <AnimatePresence mode="popLayout" initial={false} custom={d}>
                      <motion.span
                        key={index}
                        custom={d}
                        className="inline-block"
                        variants={tick}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                      >
                        {index + 1}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  &nbsp;of {total}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Skip tour"
                  className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <AnimatePresence mode="popLayout" initial={false} custom={d}>
                <motion.div
                  key={step.id}
                  custom={d}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: FOLLOW, opacity: { duration: 0.2 }, filter: { duration: 0.2 } }}
                >
                  <h2 id="tour-title" className="mt-1.5 text-base font-semibold tracking-[-0.01em]">
                    {step.title}
                  </h2>
                  <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {step.body}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1" aria-hidden>
                  {Array.from({ length: total }, (_, i) => (
                    <motion.span
                      key={i}
                      // Width springs; colour is a CSS transition, since the
                      // theme colours are CSS variables Framer can't tween.
                      className={cn(
                        'h-1.5 rounded-full transition-colors duration-300',
                        i === index ? 'bg-brand' : i < index ? 'bg-brand/35' : 'bg-foreground/15',
                      )}
                      initial={false}
                      animate={{ width: i === index ? 16 : 6 }}
                      transition={FOLLOW}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {index === 0 ? (
                    <Button variant="ghost" size="sm" onClick={onClose}>
                      Skip
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={onBack}>
                      Back
                    </Button>
                  )}
                  <Button size="sm" onClick={onNext}>
                    {last ? 'Done' : 'Next'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
