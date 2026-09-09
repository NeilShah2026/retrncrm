import * as React from 'react'
import { Puzzle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CHROME_STORE_URL } from '@/lib/constants'

const DISMISS_KEY = 'retrn-ext-banner-dismissed'

/**
 * A small, dismissible prompt to install the browser extension. Sits above
 * the phone's tab bar, bottom-right on a laptop, and stays gone once closed.
 */
export function ExtensionBanner() {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      return
    }
    const t = setTimeout(() => setShow(true), 1200)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private mode: the banner simply comes back next time.
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="complementary"
      aria-label="Browser extension"
      className="fixed inset-x-4 bottom-20 z-40 animate-fade-in md:inset-x-auto md:bottom-4 md:right-4 md:w-80"
    >
      <div className="relative rounded-lg border bg-popover p-3 shadow-popover">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-bg-sunken text-text-secondary">
            <Puzzle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Log emails to Retrn</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The browser extension files Gmail, Outlook and LinkedIn to the right person.
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button size="sm" asChild className="flex-1">
            <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer" onClick={dismiss}>
              Add to Chrome
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
