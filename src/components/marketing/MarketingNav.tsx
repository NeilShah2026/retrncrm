import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

const LINKS = [
  { href: '#features', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
]

export function MarketingNav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-50 px-4 pt-4 sm:px-6"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-full border border-black/5 bg-white/70 px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        <Link to={ROUTES.home} className="flex items-center gap-2 justify-self-start">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Users className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            Retrn
          </span>
        </Link>

        {/* True center: this column is sized to its content and centered
            within the grid track, independent of the logo/actions widths. */}
        <nav className="col-start-2 hidden items-center gap-1 justify-self-center sm:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-900"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="col-start-3 flex items-center gap-3 justify-self-end">
          <Link
            to={ROUTES.login}
            className="hidden text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 sm:inline"
          >
            Sign in
          </Link>
          <Link
            to={ROUTES.login}
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-transform hover:scale-[1.03]"
          >
            Get Retrn free
          </Link>
        </div>
      </div>
    </motion.header>
  )
}
