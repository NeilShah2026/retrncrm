import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/**
 * The full-bleed phone controls: a 50pt button and the app's own mark.
 *
 * These are the shape iOS uses on a screen that is the whole screen — sign
 * in, onboarding, a paywall — as opposed to `ui/button.tsx`, which is sized
 * for the dense chrome inside the app. They live here rather than inside the
 * sign-in page because more than one full-screen flow needs them, and two
 * hand-made 50pt capsules that drift apart by two pixels is exactly the kind
 * of thing that makes an app feel assembled rather than designed.
 */

export const CAPSULE_VARIANT = {
  apple: 'bg-[#000] text-white dark:bg-white dark:text-black',
  outline: 'bg-bg-elevated text-foreground ring-1 ring-inset ring-border',
  primary: 'bg-brand text-brand-foreground',
  /** Near-black rather than brand: the default action on a neutral screen. */
  dark: 'bg-primary text-primary-foreground',
} as const

/** A 50pt full-width capsule. */
export function CapsuleButton({
  variant,
  loading,
  className,
  children,
  onClick,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: keyof typeof CAPSULE_VARIANT
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={(e) => {
        tapFeedback()
        onClick?.(e)
      }}
      className={cn(
        'press-scale text-ios-headline flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px]',
        'disabled:opacity-45',
        CAPSULE_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : children}
    </button>
  )
}

/** The app icon, at the size a launch or welcome screen shows it. */
export function AppMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center', className)}>
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--glass-shadow)/0.18)]">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.02em]">R</span>
      </span>
    </div>
  )
}
