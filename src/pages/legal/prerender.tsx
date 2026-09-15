import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'
import { PrivacyPolicyPage } from './PrivacyPolicyPage'
import { TermsPage } from './TermsPage'

/**
 * Server entry for scripts/prerender-legal.mjs. The SPA renders these pages
 * client-side, which leaves the raw HTML at /privacy and /terms as an empty
 * <div id="root"> — and App Store review, Google's OAuth verification, and
 * the Chrome Web Store all check those URLs with tools that don't run
 * JavaScript. Rendering them to static markup at build time means the policy
 * text is in the document itself.
 */
export const LEGAL_PAGES: {
  path: string
  file: string
  title: string
  description: string
  element: ReactElement
}[] = [
  {
    path: ROUTES.privacy,
    file: 'privacy.html',
    title: 'Privacy Policy · Retrn',
    description:
      'What Retrn collects, how it is used and shared, and the choices you have — including AI features, voice input, and the browser extension.',
    element: <PrivacyPolicyPage />,
  },
  {
    path: ROUTES.terms,
    file: 'terms.html',
    title: 'Terms of Service · Retrn',
    description: 'The terms that govern your use of Retrn on the web, on iOS, and in the browser extension.',
    element: <TermsPage />,
  },
]

export function render(path: string): string {
  const page = LEGAL_PAGES.find((p) => p.path === path)
  if (!page) throw new Error(`No legal page for ${path}`)
  return renderToStaticMarkup(<StaticRouter location={path}>{page.element}</StaticRouter>)
}
