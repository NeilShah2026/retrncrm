import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * What a page wants its phone navigation bar to look like. On a phone this
 * replaces the desktop `header` entirely: one bar per screen, holding only
 * what that screen needs.
 */
export interface MobileChrome {
  /** The screen's name. Omit for a screen that shouldn't announce itself. */
  title?: string
  /** A quiet line under the large title — a count, a status. */
  subtitle?: string
  /** Bar button items on the left. A back chevron on a pushed screen. */
  leading?: React.ReactNode
  /** Bar button items on the right. */
  trailing?: React.ReactNode
  /** Pinned directly under the bar: a search field, a segmented control. */
  toolbar?: React.ReactNode
  /** false keeps the title small and permanent in the bar. */
  largeTitle?: boolean
}

/**
 * An iOS bar button item: a glyph with a 44pt touch target. Tinted with the
 * brand accent — the one place on a phone screen the accent appears, since
 * it is how iOS says "this is tappable".
 */
export const BarButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tinted?: boolean }
>(({ className, tinted = true, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'press flex h-11 min-w-[2.75rem] items-center justify-center gap-1 px-1 text-[17px]',
      '[&_svg]:h-[22px] [&_svg]:w-[22px] [&_svg]:shrink-0',
      tinted ? 'text-brand' : 'text-foreground',
      className,
    )}
    {...props}
  />
))
BarButton.displayName = 'BarButton'

/** The back affordance: a chevron and where you came from. */
export function BackBarButton({ label = 'Back' }: { label?: string }) {
  const navigate = useNavigate()
  return (
    <BarButton
      onClick={() => navigate(-1)}
      aria-label={`Back to ${label}`}
      className="-ml-2 pr-2"
    >
      <ChevronLeft className="-mr-1" strokeWidth={2.5} />
      <span className="max-w-[7rem] truncate">{label}</span>
    </BarButton>
  )
}

/** The large title, as it appears in the scrolling content. */
export function MobileLargeTitle({
  title,
  subtitle,
  className,
}: {
  title: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('pb-1 pt-0.5 md:hidden', className)}>
      <h1 className="text-large-title">{title}</h1>
      {subtitle && (
        <p className="mt-0.5 text-[15px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

interface Props {
  chrome: MobileChrome
  showCompactTitle: boolean
  pinLargeTitle: boolean
  separated: boolean
}

/** The phone's navigation bar: 44pt tall, translucent, title centred. */
export function MobileNavBar({ chrome, showCompactTitle, pinLargeTitle, separated }: Props) {
  return (
    <div
      className={cn(
        'chrome material-bar sticky top-0 z-30 shrink-0 pt-[env(safe-area-inset-top)] md:hidden',
        separated && 'hairline-b',
      )}
    >
      <div className="grid h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3">
        <div className="flex items-center justify-start gap-1">{chrome.leading}</div>

        <div
          className={cn(
            'min-w-0 px-1 text-center transition-opacity duration-base',
            showCompactTitle ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden={!showCompactTitle}
        >
          <p className="truncate text-[17px] font-semibold tracking-[-0.01em]">
            {chrome.title}
          </p>
        </div>

        <div className="flex items-center justify-end gap-0.5">{chrome.trailing}</div>
      </div>

      {pinLargeTitle && chrome.title && (
        <MobileLargeTitle
          title={chrome.title}
          subtitle={chrome.subtitle}
          className="px-4 pb-2"
        />
      )}

      {chrome.toolbar && <div className="px-4 pb-2">{chrome.toolbar}</div>}
    </div>
  )
}
