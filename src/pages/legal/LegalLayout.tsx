import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Logo } from '@/components/layout/AppLayout'
import { ROUTES } from '@/lib/routes'

/**
 * Shared shell + typographic primitives for the Privacy Policy and Terms
 * pages. Same tokens as everything else; constrained line length.
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
        <p className="mt-2 text-sm text-muted-foreground">Effective date: {effectiveDate}</p>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            Retrn is a pre-launch product built by a student. This document is being finalized
            ahead of public launch; sections marked <PlaceholderInline>TO BE FINALIZED</PlaceholderInline>{' '}
            will be completed before paid plans go live. Questions? Email{' '}
            <a href="mailto:hello@retrncrm.com" className="text-brand underline underline-offset-2">
              hello@retrncrm.com
            </a>
            .
          </p>
        </div>

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
    <section>
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
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

/** Visibly-flagged placeholder for items that need a real answer pre-launch. */
export function PlaceholderInline({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-[13px] font-medium text-warning">
      [{children}]
    </span>
  )
}
