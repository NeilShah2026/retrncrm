import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/AppLayout'
import { ROUTES } from '@/lib/routes'

const LINKS = [
  { label: 'Product', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Sign in', href: ROUTES.login },
  { label: 'Privacy', href: ROUTES.privacy },
  { label: 'Terms', href: ROUTES.terms },
]

export function MarketingFooter() {
  return (
    <footer className="border-t bg-bg-sunken/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo />
          <p className="mt-2 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Retrn. Built for the people you haven’t met yet.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary" aria-label="Footer">
          {LINKS.map((l) =>
            l.href.startsWith('#') ? (
              <a key={l.label} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} to={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  )
}
