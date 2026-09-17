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
 * How far it scrolls before the bar stops being invisible. Deliberately
 * almost nothing: the glass should appear the instant content starts passing
 * under it, not after a deliberate scroll.
 */
const MATERIALISE_AT = 2

/**
 * Every app page's layout. Desktop: a pinned header over a scrolling body.
 * Phone: an iOS navigation bar that content scrolls *under* — transparent
 * while the page sits at its top, glass once anything passes beneath it,
 * which is the scroll-edge behaviour UIKit gives a navigation bar for free.
 *
 * The bar is sticky *inside* the scroll container rather than floating over
 * it, so the first row of a page can never start underneath it: flow reserves
 * the bar's height at rest, and stickiness is what lets content slide under
 * it once it moves. Nothing has to measure anything.
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
  const [atTop, setAtTop] = React.useState(true)

  const hasTitle = Boolean(mobile?.title)
  const wantsLargeTitle = hasTitle && mobile?.largeTitle !== false
  const inlineLargeTitle = wantsLargeTitle && scrollBody
  const pinLargeTitle = wantsLargeTitle && !scrollBody

  // A large-title screen whose bar carries nothing — no back chevron, no
  // actions, no toolbar — has a 44pt row with nothing in it sitting between
  // the status bar and the title, which reads as the page starting a long way
  // down. Collapse it: the title then begins just under the status bar, and
  // since the bar has no room for a compact title there is no handoff to
  // make on scroll either. The height is fixed, not animated, so nothing
  // reflows mid-scroll.
  const collapseBar =
    inlineLargeTitle && !mobile?.leading && !mobile?.trailing && !mobile?.toolbar

  // A page that runs its own scroll regions (a board, a table with a sticky
  // header) has nothing passing under the bar, so the bar stays above that
  // region in flow and keeps its material.
  const stickyBar = Boolean(mobile) && scrollBody

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop } = e.currentTarget
    const nextAtTop = scrollTop <= MATERIALISE_AT
    setAtTop((prev) => (prev === nextAtTop ? prev : nextAtTop))
    if (!inlineLargeTitle || collapseBar) return
    const nextScrolled = scrollTop > COLLAPSE_AT
    setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled))
  }

  const navBar = mobile && (
    <MobileNavBar
      chrome={mobile}
      showCompactTitle={hasTitle && !collapseBar && (!wantsLargeTitle || scrolled)}
      pinLargeTitle={pinLargeTitle}
      separated={Boolean(mobile.toolbar) || pinLargeTitle || scrolled}
      transparent={stickyBar && atTop}
      collapsed={collapseBar}
      className={stickyBar ? 'sticky top-0' : undefined}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!stickyBar && navBar}

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
            ? 'scroll-native overflow-y-auto overscroll-contain scrollbar-thin'
            : 'overflow-hidden',
          !scrollBody && 'flex flex-col',
          bodyClassName,
        )}
      >
        {stickyBar && navBar}

        <div
          className={cn(
            'mx-auto w-full px-4 py-4 md:px-6 md:py-5',
            // The bar above already supplies the gap iOS puts over a large
            // title; another 16px of body padding on top of it is what makes
            // a large-title screen start a third of the way down.
            inlineLargeTitle && 'pt-0',
            // The tab bar floats over this column on a phone; without this
            // the last row of every page sits under it.
            scrollBody && 'pb-tab-bar md:pb-5',
            // A page running its own scroll regions pads inside them instead:
            // any padding here would leave a dead strip along the bottom of
            // the screen that reads as the content stopping short.
            !scrollBody && 'pb-0',
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
