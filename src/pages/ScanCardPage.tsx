import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Download, Loader2, UserPlus } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { ScanCard } from '@/components/scan/ScanCard'
import { FollowUpAsk } from '@/components/scan/FollowUpAsk'
import { SendBackForm } from '@/components/scan/SendBackForm'
import { track } from '@/lib/analytics'
import { decodeProfile, type ShareProfile } from '@/lib/shareProfile'
import { resolveCard, reportSaved } from '@/lib/sharedCard'
import { saveVCard, type SaveOutcome } from '@/lib/vcard'
import { ROUTES } from '@/lib/routes'

/**
 * Where a scanned Retrn card lands.
 *
 * Two routes, one page. `/add#<token>` carries the whole profile inside the
 * link and needs nothing from the server; `/c/<slug>` is the short, printable
 * link and resolves the profile through `/api/card`. Both then behave
 * identically, because to the person holding the phone they are the same
 * thing: someone they just met, on a screen.
 *
 * The order of what follows is the whole design. Almost everyone arriving
 * here has never heard of Retrn and is standing in front of the person whose
 * code they just scanned. So the first thing offered costs nothing and works
 * without an account — the contact, straight into their phone. The sign-up
 * comes second, and only in exchange for something they can already feel the
 * want of: a reminder to actually follow up, and a note of where this was.
 */

/** Today, in the local timezone rather than UTC. */
function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

type Load =
  | { state: 'loading' }
  | { state: 'ready'; profile: ShareProfile }
  | { state: 'broken' }

export function ScanCardPage() {
  const { slug } = useParams<{ slug: string }>()
  const [load, setLoad] = React.useState<Load>(() => {
    if (slug) return { state: 'loading' }
    // A self-contained link: the profile is the fragment (or `?c=` on the
    // older ones), so there is nothing to wait for.
    const hash = window.location.hash.replace(/^#/, '')
    const query = new URLSearchParams(window.location.search).get('c') ?? ''
    const profile = decodeProfile(hash || query)
    return profile ? { state: 'ready', profile } : { state: 'broken' }
  })

  const [where, setWhere] = React.useState('')
  const [saved, setSaved] = React.useState<SaveOutcome | null>(null)
  const [saving, setSaving] = React.useState(false)
  const metOn = React.useMemo(todayIso, [])

  React.useEffect(() => {
    if (!slug) return
    let live = true
    void resolveCard(slug, { count: true }).then((profile) => {
      if (!live) return
      setLoad(profile ? { state: 'ready', profile } : { state: 'broken' })
    })
    return () => {
      live = false
    }
  }, [slug])

  const ready = load.state === 'ready'
  React.useEffect(() => {
    if (ready) track('card_viewed', { via: slug ? 'short-link' : 'token' })
  }, [ready, slug])

  async function save() {
    if (load.state !== 'ready') return
    setSaving(true)
    try {
      const outcome = await saveVCard(load.profile, { where: where.trim() || undefined, on: metOn })
      if (outcome === 'cancelled') return
      setSaved(outcome)
      if (slug) reportSaved(slug)
      track('card_contact_saved', { outcome })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="mx-auto w-full max-w-md px-4 pt-6 sm:px-6">
        <Link
          to={ROUTES.home}
          className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Logo />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-6 sm:px-6">
        {load.state === 'loading' && <Loading />}
        {load.state === 'broken' && <Broken />}
        {load.state === 'ready' && (
          <div className="space-y-4">
            <ScanCard profile={load.profile} />

            <div>
              <Button
                size="lg"
                onClick={() => void save()}
                loading={saving}
                className="h-11 w-full text-base"
              >
                {!saving && (saved ? <Check /> : <UserPlus />)}
                {saved ? 'Saved to Contacts' : 'Save to Contacts'}
              </Button>
              <p className="mt-2 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
                {saved === 'downloaded' && <Download className="mt-0.5 h-3 w-3 shrink-0" />}
                <span>
                  {saved === 'downloaded'
                    ? 'Open the downloaded card to add them to your phone.'
                    : saved === 'shared'
                      ? 'Saved — along with where and when you met.'
                      : 'Goes straight into your phone. No account, no app.'}
                </span>
              </p>
            </div>

            <FollowUpAsk
              profile={load.profile}
              slug={slug}
              metOn={metOn}
              where={where}
              onWhereChange={setWhere}
            />

            {slug && (
              <SendBackForm
                profile={load.profile}
                slug={slug}
                whereWeMet={where}
                metOn={metOn}
              />
            )}
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:px-6">
        <p className="text-xs text-muted-foreground">
          <Link to={ROUTES.home} className="hover:text-foreground">
            Retrn
          </Link>
          {' · '}
          <Link to={ROUTES.privacy} className="hover:text-foreground">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Opening this card…
    </div>
  )
}

function Broken() {
  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">This card isn’t here</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The link may have been mistyped, or the code may have been replaced. Ask them to show
        you their Retrn code again.
      </p>
      <Button variant="outline" size="sm" asChild className="mt-5">
        <Link to={ROUTES.home}>What is Retrn?</Link>
      </Button>
    </div>
  )
}
