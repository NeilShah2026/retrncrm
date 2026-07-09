import { cn } from '@/lib/utils'

/**
 * Shared building blocks for the live marketing mockups. These render real
 * DOM styled to match the Retrn app — no screenshots — so the landing page
 * feels like the product is actually running, and stays on-brand for free.
 */

const AVATAR_GRADIENTS: Record<string, string> = {
  rose: 'from-rose-400 to-rose-600',
  orange: 'from-orange-400 to-orange-600',
  amber: 'from-amber-400 to-amber-600',
  emerald: 'from-emerald-400 to-emerald-600',
  teal: 'from-teal-400 to-teal-600',
  sky: 'from-sky-400 to-sky-600',
  blue: 'from-blue-400 to-blue-600',
  indigo: 'from-indigo-400 to-indigo-600',
  violet: 'from-violet-400 to-violet-600',
  fuchsia: 'from-fuchsia-400 to-fuchsia-600',
}

export function MockAvatar({
  initials,
  color = 'indigo',
  size = 36,
  className,
}: {
  initials: string
  color?: keyof typeof AVATAR_GRADIENTS
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
        AVATAR_GRADIENTS[color],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}

const TAG_TONES: Record<string, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-300',
  violet: 'bg-violet-500/15 text-violet-300',
  rose: 'bg-rose-500/15 text-rose-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-300',
  sky: 'bg-sky-500/15 text-sky-300',
  slate: 'bg-white/10 text-white/60',
}

export function MockTag({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode
  tone?: keyof typeof TAG_TONES
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
        TAG_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * The floating app surface every mockup sits on: a dark card with a soft
 * inner highlight and generous shadow, no browser chrome — reads as a live
 * slice of the product rather than a pasted screenshot.
 */
export function MockSurface({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        // text-left guards against inheriting text-center from a hero/section
        // wrapper — mockups must always read like the left-aligned app UI.
        'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0c15]/95 text-left shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl',
        className,
      )}
    >
      {/* top inner highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      {children}
    </div>
  )
}
