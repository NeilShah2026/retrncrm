import * as React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { ROUTES } from '@/lib/routes'
import { LEGAL } from './legalInfo'

/**
 * Shared shell + typographic primitives for the Privacy Policy and Terms
 * pages. Same tokens as everything else; constrained line length.
 *
 * These pages are also prerendered to static HTML at build time
 * (scripts/prerender-legal.mjs), so everything here must render without the
 * app's providers and without touching `window`.
 */
export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string
  intro?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-text-secondary">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to={ROUTES.home} className="rounded-sm">
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-text-secondary" aria-label="Legal">
            <Link to={ROUTES.privacy} className="hover:text-foreground">
              Privacy
            </Link>
            <Link to={ROUTES.terms} className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-display text-3xl text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {LEGAL.effectiveDate} · Last updated: {LEGAL.effectiveDate}
        </p>

        {intro && <div className="mt-6 space-y-3 text-[15px] leading-relaxed">{intro}</div>}

        <div className="mt-10 space-y-9">{children}</div>

        <div className="mt-14 border-t pt-6 text-sm text-muted-foreground">
          <Link to={ROUTES.home} className="hover:text-foreground">
            Back to Retrn
          </Link>
        </div>
      </main>
    </div>
  )
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`section-${n}`}>
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-[15px] font-semibold text-foreground">{children}</h3>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground/60">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>
}

/** A mailto link in the brand style. */
export function Mail({ to }: { to: string }) {
  return (
    <a href={`mailto:${to}`} className="text-brand underline underline-offset-2">
      {to}
    </a>
  )
}

/** An in-document link to another legal page. */
export function DocLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-brand underline underline-offset-2">
      {children}
    </Link>
  )
}

/** An external link (opens in a new tab). */
export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
      {children}
    </a>
  )
}

/** A compact three-column table (e.g. the service-provider list); the first column is bold. */
export function Table({ head, rows }: { head: [string, string, string]; rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              {r.map((cell, j) => (
                <td key={j} className={j === 0 ? 'px-3 py-2 font-semibold text-foreground' : 'px-3 py-2'}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
