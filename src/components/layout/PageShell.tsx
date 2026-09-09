import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  MobileLargeTitle,
  MobileNavBar,
  type MobileChrome,
} from '@/components/layout/MobileNavBar'

interface PageShellProps {
  /** Pinned content — title, description, actions, toolbar. Never scrolls. */
  header: React.ReactNode
  /**
   * The phone's navigation bar for this screen. When given, it replaces
   * `header` below `md` entirely.
   */
  mobile?: MobileChrome
  children: React.ReactNode
  /** 'default' caps width for reading; 'wide' fills for boards/tables. */
  width?: 'default' | 'wide'
  /**
   * true (default): this component's body div is the scroll container.
   * false: the page manages its own inner scroll region (a table with a
   * sticky header, a board with per-column scrolling).
   */
  scrollBody?: boolean
  bodyClassName?: string
}

const WIDTH_CLASS = {
  default: 'max-w-6xl',
  wide: 'max-w-[1600px]',
}

/** How far the body scrolls before the large title hands off to the bar. */
const COLLAPSE_AT = 24

/**
 * Every app page's layout. Desktop: a pinned header over a scrolling body.
 * Phone: an iOS navigation bar over a body that scrolls the large title away.
 */
export function PageShell({
  header,
  mobile,
  children,
  width = 'default',
  scrollBody = true,
  bodyClassName,
}: PageShellProps) {
  const [scrolled, setScrolled] = React.useState(false)

  const hasTitle = Boolean(mobile?.title)
  const wantsLargeTitle = hasTitle && mobile?.largeTitle !== false
  const inlineLargeTitle = wantsLargeTitle && scrollBody
  const pinLargeTitle = wantsLargeTitle && !scrollBody

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!inlineLargeTitle) return
    const next = e.currentTarget.scrollTop > COLLAPSE_AT
    setScrolled((prev) => (prev === next ? prev : next))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mobile && (
        <MobileNavBar
          chrome={mobile}
          showCompactTitle={hasTitle && (!wantsLargeTitle || scrolled)}
          pinLargeTitle={pinLargeTitle}
          separated={Boolean(mobile.toolbar) || pinLargeTitle || scrolled}
        />
      )}

      <div
        className={cn(
          'shrink-0 border-b px-4 pb-3 pt-4 md:px-6 md:pt-5',
          mobile && 'hidden md:block',
        )}
      >
        <div className={cn('mx-auto w-full', WIDTH_CLASS[width])}>{header}</div>
      </div>

      <div
        onScroll={handleScroll}
        className={cn(
          'min-h-0 flex-1',
          scrollBody
            ? 'overflow-y-auto overscroll-contain scrollbar-thin'
            : 'overflow-hidden',
          !scrollBody && 'flex flex-col',
          bodyClassName,
        )}
      >
        <div
          className={cn(
            'mx-auto w-full px-4 py-4 md:px-6 md:py-5',
            inlineLargeTitle && 'pt-2',
            WIDTH_CLASS[width],
            !scrollBody && 'flex min-h-0 flex-1 flex-col',
          )}
        >
          {inlineLargeTitle && mobile?.title && (
            <MobileLargeTitle
              title={mobile.title}
              subtitle={mobile.subtitle}
              className="mb-2"
            />
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
