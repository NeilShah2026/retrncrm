import * as React from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
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
      {step &&
        index !== null &&
        createPortal(
          <TourOverlay
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            onNext={next}
            onBack={back}
            onClose={() => close(false)}
            onMissing={missing}
          />,
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
  const [card, setCard] = React.useState({ width: 320, height: 180 })
  const cardRef = React.useRef<HTMLDivElement>(null)
  const onMissingRef = React.useRef(onMissing)
  onMissingRef.current = onMissing

  // Find the element (the page may still be loading), then follow it: a
  // panel that grows as data arrives, a window that's resized.
  React.useEffect(() => {
    let frame = 0
    let found = false
    const startedAt = performance.now()
    const tick = () => {
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
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [step.target])

  React.useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (Math.abs(width - card.width) > 0.5 || Math.abs(height - card.height) > 0.5) {
      setCard({ width, height })
    }
  })

  React.useEffect(() => {
    cardRef.current?.focus()
  }, [box === null])

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
  const placed = hole ? placeCard(hole, card, step.placement) : null
  const last = index === total - 1

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Blocks clicks on the page while the tour is up; the tour drives. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[10px] ring-2 ring-brand/70 transition-all duration-300 ease-out"
          style={{
            ...hole,
            boxShadow: '0 0 0 9999px rgba(10, 12, 18, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(10,12,18,0.55)]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className={cn(
          'absolute w-80 rounded-xl border bg-card p-4 text-card-foreground shadow-lg outline-none',
          'transition-[top,left,opacity] duration-300 ease-out',
          placed ? 'opacity-100' : 'opacity-0',
        )}
        style={placed ? { top: placed.top, left: placed.left } : { top: -9999, left: -9999 }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="tnum text-xs font-medium text-brand">
            Step {index + 1} of {total}
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
        <h2 id="tour-title" className="mt-1.5 text-base font-semibold tracking-[-0.01em]">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-4 bg-brand' : 'w-1.5 bg-foreground/15',
                )}
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
    </div>
  )
}
