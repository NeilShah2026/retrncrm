import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Puzzle, X, ArrowRight } from 'lucide-react'
import { CHROME_STORE_URL } from '@/lib/constants'

const DISMISS_KEY = 'retrn-ext-banner-dismissed'

/**
 * A small, dismissible prompt to install the browser extension. Sits at the
 * bottom (above the mobile nav), and stays gone once closed.
 */
export function ExtensionBanner() {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    // Delay slightly so it eases in after the app settles, and respect a prior
    // dismissal.
    if (localStorage.getItem(DISMISS_KEY)) return
    const t = setTimeout(() => setShow(true), 1200)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-20 z-40 md:inset-x-auto md:bottom-4 md:right-4 md:w-80"
        >
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-lg">
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                <Puzzle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Log emails to Retrn</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add the browser extension for Gmail, Outlook &amp; LinkedIn.
                </p>
              </div>
            </div>

            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={dismiss}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              Add to Chrome
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
