import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { isNative } from '@/lib/platform'
import { ROUTES } from '@/lib/routes'

/**
 * Hosts where the phone web app is closed in favour of the iPhone app.
 *
 * Deliberately a list of exact hostnames rather than "any production host":
 * every preview deployment and localhost keeps working on a phone browser, so
 * this can never lock development out.
 */
const APP_ONLY_HOSTS = ['retrnapp.com', 'www.retrnapp.com', 'retrncrm.com', 'www.retrncrm.com']

/**
 * Paths that must keep working on a phone browser whatever the host:
 * /add is where a scanned QR code lands (the whole point of it is that a
 * stranger opens it on their phone), /verify-edu is where the school-email
 * link lands (and school inboxes live on phones), and the legal pages have to
 * be reachable from anywhere — the app stores require it.
 */
const ALWAYS_OPEN = [ROUTES.add, ROUTES.verifyEdu, ROUTES.privacy, ROUTES.terms]

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
 * website. This says so instead of handing someone the desktop product shrunk
 * onto a phone.
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
        <p className="text-label text-muted-foreground">On your phone</p>
        <h1 className="text-display mt-3 text-[2.25rem]">Open Retrn in the app.</h1>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          On a phone, Retrn only works as the iPhone app — the website isn't available in a
          mobile browser. Open the Retrn app and sign in there with the same account.
        </p>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          On a computer? Visit <span className="text-foreground">{window.location.hostname.replace(/^www\./, '')}</span>{' '}
          in your browser to use the full website.
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
