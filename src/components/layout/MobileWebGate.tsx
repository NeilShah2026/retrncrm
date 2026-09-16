import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { isNative } from '@/lib/platform'
import { ROUTES } from '@/lib/routes'

/**
 * Hosts where the phone web app is closed in favour of the iPhone app.
 *
 * Deliberately a list of exact hostnames rather than "any production host":
 * retrncrm.com keeps working on a phone browser, and so does every preview
 * deployment and localhost, so this can never lock development out.
 */
const APP_ONLY_HOSTS = ['retrnapp.com', 'www.retrnapp.com']

/**
 * Paths that must keep working on a phone browser whatever the host:
 * /add is where a scanned QR code lands (the whole point of it is that a
 * stranger opens it on their phone), and the legal pages have to be
 * reachable from anywhere — the app stores require it.
 */
const ALWAYS_OPEN = [ROUTES.add, ROUTES.privacy, ROUTES.terms]

/** A phone, not a narrow desktop window: small *and* touch-first. */
function useIsPhoneBrowser(): boolean {
  const query = '(max-width: 767px) and (pointer: coarse)'
  const [isPhone, setIsPhone] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  React.useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setIsPhone(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return isPhone
}

/**
 * On a phone, on the hosts listed above, Retrn is an app you install — not a
 * website. Until that app ships, this says so instead of handing someone the
 * desktop product shrunk onto a phone.
 */
export function MobileWebGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isPhone = useIsPhoneBrowser()

  const gated =
    !isNative &&
    isPhone &&
    APP_ONLY_HOSTS.includes(window.location.hostname) &&
    !ALWAYS_OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!gated) return <>{children}</>

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+4rem)]">
      <Logo />

      <div className="mt-auto">
        <p className="text-label text-muted-foreground">iPhone app</p>
        <h1 className="text-display mt-3 text-[2.25rem]">Coming soon.</h1>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          On a phone, Retrn is an app rather than a website — so there's nothing to sign into
          here yet. It's close; the app is what this page becomes.
        </p>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          In the meantime, open <span className="text-foreground">retrnapp.com</span> on a
          computer to add contacts, log emails and keep up with your network.
        </p>
      </div>

      <div className="mt-auto pt-10">
        <p className="text-xs text-muted-foreground">
          <Link to={ROUTES.privacy} className="hover:text-foreground">
            Privacy
          </Link>
          {' · '}
          <Link to={ROUTES.terms} className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}
