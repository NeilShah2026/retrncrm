import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

const LINKS = [
  { href: '#features', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
]

/** Sticky, hairline-bottom, translucent. The same wordmark as the app. */
export function MarketingNav() {
  return (
    <header className="material-bar sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to={ROUTES.home} className="rounded-sm">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Site">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors duration-fast hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link to={ROUTES.login}>Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to={ROUTES.login}>Get Retrn free</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
