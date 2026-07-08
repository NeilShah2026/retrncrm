import { cn } from '@/lib/utils'

interface PageShellProps {
  /** Pinned content — title, description, actions, toolbar. Never scrolls. */
  header: React.ReactNode
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

/**
 * Every app page's layout: a header that never moves, and a body beneath it
 * that owns the only scrollbar for that page. This is what makes "only the
 * list scrolls, not the whole page" true everywhere, not just on Contacts.
 */
export function PageShell({
  header,
  children,
  width = 'default',
  scrollBody = true,
  bodyClassName,
}: PageShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b px-4 pb-3 pt-5 md:px-8 md:pt-8">
        <div className={cn('mx-auto w-full', WIDTH_CLASS[width])}>{header}</div>
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          scrollBody ? 'overflow-y-auto scrollbar-thin' : 'overflow-hidden',
          !scrollBody && 'flex flex-col',
          bodyClassName,
        )}
      >
        <div
          className={cn(
            'mx-auto w-full px-4 py-4 md:px-8 md:py-6',
            WIDTH_CLASS[width],
            !scrollBody && 'flex min-h-0 flex-1 flex-col',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
