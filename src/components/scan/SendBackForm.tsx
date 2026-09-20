import * as React from 'react'
import { Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics'
import { sendHandoff } from '@/lib/sharedCard'
import type { ShareProfile } from '@/lib/shareProfile'

/**
 * The other half of a card exchange.
 *
 * A QR code is one-directional: they hand you their details and get nothing
 * back, which is exactly the half of a business card swap that a paper card
 * does better. This closes it — without an account, without an app, in the
 * thirty seconds the two people are still standing together.
 *
 * What gets sent waits in the card owner's QR screen as something to accept,
 * never straight into their contacts: anyone holding the link can write one
 * of these, and an address book that strangers can add rows to is not an
 * address book.
 *
 * Only offered for a published card (`/c/<slug>`). A self-contained
 * `/add#<token>` link has no route back, and an offer that quietly does
 * nothing is worse than no offer.
 */

type Stage = 'idle' | 'open' | 'sent'

export function SendBackForm({
  profile,
  slug,
  whereWeMet,
  metOn,
}: {
  profile: ShareProfile
  slug: string
  whereWeMet?: string
  metOn: string
}) {
  const [stage, setStage] = React.useState<Stage>('idle')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const firstName = profile.name.trim().split(/\s+/)[0]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const ok = await sendHandoff(slug, {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      whereWeMet: whereWeMet?.trim() || undefined,
      metOn,
    })
    setBusy(false)
    if (!ok) {
      setError('Could not send that. Try again in a moment.')
      return
    }
    track('card_info_sent_back')
    setStage('sent')
  }

  if (stage === 'sent') {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-bg-sunken/60 p-4">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm">
          Sent. {firstName} will see your details the next time they open Retrn.
        </p>
      </div>
    )
  }

  if (stage === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStage('open')}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-sunken/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {firstName} doesn’t have your details yet
          </span>
          <span className="mt-0.5 block text-sm text-text-secondary">
            Send them back — no account needed.
          </span>
        </span>
      </button>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Send {firstName} your details</p>

      <div className="space-y-1.5">
        <Label htmlFor="back-name">Your name</Label>
        <Input
          id="back-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="back-email">Email</Label>
          <Input
            id="back-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="back-phone">Phone</Label>
          <Input
            id="back-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="back-note">Anything worth remembering</Label>
        <Textarea
          id="back-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you talked about, what you asked for…"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()} className="flex-1">
          {!busy && <Send />}
          Send
        </Button>
        <Button type="button" variant="ghost" onClick={() => setStage('idle')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
