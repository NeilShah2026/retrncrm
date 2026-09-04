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
   * `header` below `md` entirely: a desktop page header and an iOS navigation
   * bar are different objects, and squeezing one into the other is what makes
   * a phone screen feel like a shrunken website.
   */
  mobile?: MobileChrome
  children: React.ReactNode
  /** 'default' caps width for reading; 'wide' fills for boards/graphs. */
  width?: 'default' | 'wide'
  /**
   * true (default): this component's body div is the scroll container —
   * fine for pages that are just a stack of cards.
   * false: the page manages its own inner scroll region (e.g. a table with a
   * sticky header, or a Kanban board with per-column scrolling) — the body
   * div just clips and hands full height to its children.
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
 * Every app page's layout, in two shapes.
 *
 * On a desktop: a header that never moves, and a body beneath it that owns the
 * only scrollbar for that page.
 *
 * On a phone: an iOS navigation bar that never moves, and a body that scrolls
 * the large title away underneath it — at which point the small title fades
 * into the bar. Same skeleton, native manners.
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

  // The large title can only scroll away when this component owns the
  // scroller. Pages with their own inner scroll region (a table, a board) keep
  // a static large title pinned above it instead — the same choice iOS makes
  // for a screen whose content is a fixed pane.
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
          // A bar with a toolbar or a pinned title is already a solid block,
          // so it always needs its edge. A bare bar only earns a hairline once
          // there is content passing beneath it.
          separated={Boolean(mobile.toolbar) || pinLargeTitle || scrolled}
        />
      )}

      <div
        className={cn(
          'shrink-0 border-b px-4 pb-3 pt-5 md:px-8 md:pt-8',
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
            'mx-auto w-full px-4 py-4 md:px-8 md:py-6',
            // The large title supplies the top spacing on a phone, so the body
            // shouldn't add its own on top of it.
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
