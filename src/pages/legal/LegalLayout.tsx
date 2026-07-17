import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Users } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

/**
 * Shared shell + typographic primitives for the Privacy Policy and Terms
 * pages. Public routes, readable dark layout, constrained line length.
 */
export function LegalLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#08080c] text-white/70">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to={ROUTES.home} className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white">
              <Users className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">Retrn</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <Link to={ROUTES.privacy} className="hover:text-white">
              Privacy
            </Link>
            <Link to={ROUTES.terms} className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/40">Effective date: {effectiveDate}</p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-white/70">
            Retrn is a pre-launch product built by a student. This document is
            being finalized ahead of public launch; sections marked{' '}
            <PlaceholderInline>TO BE FINALIZED</PlaceholderInline> will be
            completed before paid plans go live. Questions? Email{' '}
            <a href="mailto:hello@retrncrm.com" className="text-amber-200 underline">
              hello@retrncrm.com
            </a>
            .
          </p>
        </div>

        <div className="mt-10 space-y-9">{children}</div>

        <div className="mt-14 border-t border-white/10 pt-6 text-sm text-white/40">
          <Link to={ROUTES.home} className="hover:text-white">
            ← Back to Retrn
          </Link>
        </div>
      </main>
    </div>
  )
}

export function Section({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="font-serif text-xl font-medium text-white">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-white/30">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-white">{children}</span>
}

/** Visibly-flagged placeholder for items that need a real answer pre-launch. */
export function PlaceholderInline({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[13px] font-medium text-amber-200">
      [{children}]
    </span>
  )
}
