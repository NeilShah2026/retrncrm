import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ROUTES } from '@/lib/routes'

const LINKS = [
  { label: 'Product', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Sign in', href: ROUTES.login },
  { label: 'Get started', href: ROUTES.login },
]

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#050408] pb-8 pt-16 sm:pt-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-xs font-medium uppercase tracking-wide text-white/50 sm:px-6">
        {LINKS.map((l) =>
          l.href.startsWith('#') ? (
            <a key={l.label} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </a>
          ) : (
            <Link key={l.label} to={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          ),
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="pointer-events-none select-none py-6 text-center"
      >
        <span
          className="bg-gradient-to-b from-white/25 to-white/[0.03] bg-clip-text font-serif text-[20vw] font-medium leading-none tracking-tight text-transparent sm:text-[15vw] lg:text-[160px]"
          style={{ WebkitTextStroke: '1px rgba(255,255,255,0.08)' }}
        >
          Retrn
        </span>
      </motion.div>

      <div className="mx-auto mt-2 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/10 px-4 pt-6 text-xs text-white/35 sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} Retrn. Built for the people you haven't met yet.</span>
        <span>Your data stays on your device.</span>
      </div>
    </footer>
  )
}
