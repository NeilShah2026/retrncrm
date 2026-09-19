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
 * The platform itself — signing in and everything under /app. Only these are
 * closed on a phone browser; the marketing homepage, the QR landing page
 * (/add), the school-email link (/verify-edu) and the legal pages all stay
 * open, since people reach those from their phones on purpose.
 */
const APP_ONLY_PATHS = [ROUTES.app, ROUTES.login]

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
 * On a phone, on the hosts listed above, the Retrn platform is an app you
 * install — not a website. The homepage is still browsable; trying to sign in
 * or open the product says so instead of handing someone the desktop product
 * shrunk onto a phone.
 */
export function MobileWebGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isPhone = useIsPhoneBrowser()

  const gated =
    !isNative &&
    isPhone &&
    APP_ONLY_HOSTS.includes(window.location.hostname) &&
    APP_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!gated) return <>{children}</>

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[calc(env(safe-area-inset-top)+4rem)]">
      <Logo />

      <div className="mt-auto">
        <p className="text-label text-muted-foreground">On your phone</p>
        <h1 className="text-display mt-3 text-[2.25rem]">Open Retrn in the app.</h1>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          On a phone, Retrn works in the iPhone app — signing in from a mobile browser isn't
          supported. Open the Retrn app and sign in there with the same account.
        </p>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          On a computer? Visit <span className="text-foreground">{window.location.hostname.replace(/^www\./, '')}</span>{' '}
          in your browser to use the full website.
        </p>
      </div>

      <div className="mt-auto pt-10">
        <p className="text-xs text-muted-foreground">
          <Link to={ROUTES.home} className="hover:text-foreground">
            Back to homepage
          </Link>
          {' · '}
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
