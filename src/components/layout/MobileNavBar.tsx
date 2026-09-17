import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { tapFeedback } from '@/lib/haptics'
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
>(({ className, tinted = true, onClick, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={(e) => {
      tapFeedback()
      onClick?.(e)
    }}
    className={cn(
      'press text-ios-body flex h-11 min-w-[2.75rem] items-center justify-center gap-1 px-1',
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
    <div className={cn('pb-1 md:hidden', className)}>
      <h1 className="text-ios-large-title">{title}</h1>
      {subtitle && (
        <p className="text-ios-subhead mt-1 text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

interface Props {
  chrome: MobileChrome
  showCompactTitle: boolean
  pinLargeTitle: boolean
  separated: boolean
  /**
   * True while the page it sits over is scrolled to its very top, where an
   * iOS navigation bar shows no material at all and the content appears to
   * run to the top of the screen. The glass returns the moment anything
   * scrolls under it.
   */
  transparent?: boolean
  /**
   * True for a large-title screen whose bar holds nothing at all — no back
   * chevron, no actions, no toolbar. There is then nothing for the 44pt row
   * to carry, and leaving it there puts an empty band between the status bar
   * and the title. Collapsed, the bar keeps only the safe-area inset and a
   * sliver of glass, and the title starts where the screen does.
   */
  collapsed?: boolean
  className?: string
}

/** The phone's navigation bar: 44pt tall, glass, title centred. */
export function MobileNavBar({
  chrome,
  showCompactTitle,
  pinLargeTitle,
  separated,
  transparent,
  collapsed,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'chrome glass scroll-edge z-30 shrink-0 border-b border-transparent pt-[env(safe-area-inset-top)] md:hidden',
        transparent && 'scroll-edge-idle',
        separated && !transparent && 'border-border',
        className,
      )}
    >
      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2',
          collapsed ? 'h-2' : 'h-11',
        )}
      >
        <div className="flex items-center justify-start gap-1">{chrome.leading}</div>

        <div
          className={cn(
            'min-w-0 px-1 text-center transition-opacity duration-base',
            showCompactTitle ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden={!showCompactTitle}
        >
          <p className="text-ios-headline truncate">{chrome.title}</p>
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
