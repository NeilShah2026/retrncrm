import * as React from 'react'

/**
 * True when the viewport is narrower than `breakpoint` (default 768px, the
 * point where the app switches from the desktop sidebar to mobile chrome).
 * Used to switch desktop-oriented UI (wide tables, hover affordances) to
 * touch-friendly equivalents.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  React.useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}
