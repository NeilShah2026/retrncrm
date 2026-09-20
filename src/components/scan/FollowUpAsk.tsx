import * as React from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Check } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useAppIsGatedHere } from '@/components/layout/MobileWebGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { track } from '@/lib/analytics'
import { ROUTES } from '@/lib/routes'
import { contactRepo, followUpRepo } from '@/services'
import { profileToContactDraft, type ShareProfile } from '@/lib/shareProfile'
import { stashPendingScan } from '@/lib/pendingScan'
import { isContactLimitError } from '@/lib/billing/contactLimit'
import { cn } from '@/lib/utils'

/**
 * The ask, after the card has already been given away.
 *
 * The order matters more than the copy. Saving someone to your phone needs
 * no account and happens first; this is the second thing on the screen, and
 * it asks for a sign-up in exchange for something the person can already
 * feel the want of — they just met someone and they know perfectly well they
 * will forget to follow up.
 *
 * There is no email being sent at the end of this. What the account buys is
 * the person, the date, the place and a dated follow-up, waiting in a real
 * network — so that is what the copy promises, and nothing more.
 */

const OPTIONS: { days: number; label: string }[] = [
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'Next week' },
  { days: 30, label: 'In a month' },
]

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type Stage = 'idle' | 'details' | 'confirm-email' | 'done'

export function FollowUpAsk({
  profile,
  slug,
  metOn,
  where,
  onWhereChange,
}: {
  profile: ShareProfile
  slug?: string
  /** ISO date (yyyy-mm-dd) of the meeting — today, in practice. */
  metOn: string
  /**
   * Where they met. Owned by the page so that whichever of the two asks is
   * answered first — the reminder or sending details back — the other one
   * already knows the answer.
   */
  where: string
  onWhereChange: (value: string) => void
}) {
  const { user, loading, signUpWithPassword, signInWithPassword } = useAuth()
  // On a phone browser the product itself is closed until the iPhone app
  // ships, so "Open Retrn" would be a door into a wall. Say where it *is*
  // instead.
  const appIsGated = useAppIsGatedHere()
  const [stage, setStage] = React.useState<Stage>('idle')
  const [days, setDays] = React.useState<number | null>(null)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [mode, setMode] = React.useState<'signup' | 'signin'>('signup')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const firstName = profile.name.trim().split(/\s+/)[0]

  /** Signed in already: there is nothing to ask for, so just do it. */
  async function saveForSignedInUser(chosen: number) {
    setBusy(true)
    setError(null)
    try {
      const [first, ...rest] = profile.name.trim().split(/\s+/)
      const dupes = await contactRepo.findDuplicates(first ?? profile.name, rest.join(' '), profile.company)
      const contact =
        dupes[0] ??
        (await contactRepo.create({
          ...profileToContactDraft(profile),
          howWeMet: 'Scanned their Retrn card',
          whereWeMet: where.trim() || undefined,
          dateMet: metOn,
        }))
      await followUpRepo.create({
        contactId: contact.id,
        dueDate: new Date(new Date(`${metOn}T12:00:00`).getTime() + chosen * 86_400_000)
          .toISOString()
          .slice(0, 10),
        note: `Follow up with ${first ?? profile.name}`,
      })
      track('card_reminder_chosen', { days: chosen, signedIn: true })
      setStage('done')
    } catch (err) {
      if (isContactLimitError(err)) return
      console.error(err)
      setError('Could not save that. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  function choose(chosen: number) {
    setDays(chosen)
    setError(null)
    if (user) {
      void saveForSignedInUser(chosen)
      return
    }
    track('card_reminder_chosen', { days: chosen, signedIn: false })
    setStage('details')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // Stashed before the auth call, not after: the confirmation link can be
      // opened on a different tab, and whatever happens next, the person they
      // met should not be the thing that gets lost.
      stashPendingScan({
        profile,
        whereWeMet: where.trim() || undefined,
        metOn,
        remindInDays: days ?? undefined,
        slug,
      })

      if (mode === 'signin') {
        const { error: failure } = await signInWithPassword(email, password)
        if (failure) {
          setError(failure)
          return
        }
        // `applyPendingScan` runs on sign-in and writes the contact; this
        // screen only has to stop asking.
        setStage('done')
        return
      }

      const { error: failure } = await signUpWithPassword(email, password)
      if (failure) {
        setError(
          /already registered|already exists/i.test(failure)
            ? 'There is already an account on that email — sign in instead.'
            : failure,
        )
        if (/already registered|already exists/i.test(failure)) setMode('signin')
        return
      }
      setStage('confirm-email')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  if (stage === 'done') {
    return (
      <Panel tone="done">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {firstName} is in your network
              {days != null && <> — you’ll be reminded on {addDays(metOn, days)}.</>}
            </p>
            {appIsGated ? (
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                Open{' '}
                <span className="text-foreground">
                  {window.location.hostname.replace(/^www\./, '')}
                </span>{' '}
                on a computer to see your network. The iPhone app is on its way.
              </p>
            ) : (
              <Button variant="outline" size="sm" asChild className="mt-3">
                <Link to={ROUTES.dashboard}>Open Retrn</Link>
              </Button>
            )}
          </div>
        </div>
      </Panel>
    )
  }

  if (stage === 'confirm-email') {
    return (
      <Panel tone="done">
        <p className="text-sm font-medium">Check your email to confirm your account.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          {firstName} and your reminder for {days != null ? addDays(metOn, days) : 'later'} are
          saved on this device, and land in your network the moment you confirm.
          {appIsGated && (
            <>
              {' '}
              Retrn opens on a computer at{' '}
              <span className="text-foreground">
                {window.location.hostname.replace(/^www\./, '')}
              </span>{' '}
              for now — the iPhone app is on its way.
            </>
          )}
        </p>
      </Panel>
    )
  }

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-relaxed">
            Want a reminder to follow up, and to remember where you met?
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => choose(option.days)}
                disabled={busy}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  'hover:border-border-strong hover:bg-bg-sunken',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  'disabled:pointer-events-none disabled:opacity-50',
                  days === option.days && 'border-border-strong bg-bg-sunken font-medium',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {stage === 'details' && (
            <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="scan-where">Where did you meet?</Label>
                <Input
                  id="scan-where"
                  value={where}
                  onChange={(event) => onWhereChange(event.target.value)}
                  placeholder="Startup fair, Olin Hall…"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scan-email">Your email</Label>
                <Input
                  id="scan-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scan-password">
                  {mode === 'signup' ? 'Pick a password' : 'Your password'}
                </Label>
                <Input
                  id="scan-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" size="lg" loading={busy} className="w-full">
                {mode === 'signup'
                  ? `Set the reminder for ${addDays(metOn, days ?? 3)}`
                  : 'Sign in and set the reminder'}
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {mode === 'signup' ? (
                  <>
                    Free, and {firstName} stays private to you.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin')
                        setError(null)
                      }}
                      className="text-brand underline-offset-4 hover:underline"
                    >
                      Already have Retrn?
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setError(null)
                    }}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    Create an account instead
                  </button>
                )}
              </p>
            </form>
          )}

          {error && stage !== 'details' && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </Panel>
  )
}

/** The dashed container that marks this off as the optional, second ask. */
function Panel({ children, tone }: { children: React.ReactNode; tone?: 'done' }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        tone === 'done' ? 'border-border bg-bg-sunken/60' : 'border-dashed',
      )}
    >
      {children}
    </div>
  )
}
