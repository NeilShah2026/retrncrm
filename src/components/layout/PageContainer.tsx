import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
  /** 'default' caps width for reading; 'wide' fills for boards/graphs. */
  width?: 'default' | 'wide'
  /** Remove default vertical padding (for pages with their own sticky header). */
  flush?: boolean
}

/**
 * Standard page wrapper. Lives inside the app's single scroll container, so any
 * `sticky top-0` element a page renders pins to the top of the viewport while
 * the rest of the page scrolls beneath it.
 */
export function PageContainer({
  children,
  className,
  width = 'default',
  flush,
}: Props) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-24 md:px-8 md:pb-12',
        width === 'default' ? 'max-w-6xl' : 'max-w-[1600px]',
        !flush && 'pt-5 md:pt-8',
        className,
      )}
    >
      {children}
    </div>
  )
}
