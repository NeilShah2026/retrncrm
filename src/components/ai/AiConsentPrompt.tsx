import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { registerAiConsentPrompt, setAiConsent } from '@/lib/ai/consent'
import { ROUTES } from '@/lib/routes'
import { track } from '@/lib/analytics'

/**
 * The permission prompt that stands in front of every AI feature.
 *
 * Shown the first time someone taps something AI-powered, never on its own.
 * It names what is sent and who receives it, because Guideline 5.1.2(i) asks
 * for exactly that — "we use AI" is not a disclosure.
 */
export function AiConsentPrompt() {
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const resolver = React.useRef<((granted: boolean) => void) | null>(null)

  React.useEffect(() => {
    registerAiConsentPrompt(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve
          setOpen(true)
        }),
    )
    return () => registerAiConsentPrompt(null)
  }, [])

  function settle(granted: boolean) {
    resolver.current?.(granted)
    resolver.current = null
    setOpen(false)
  }

  async function allow() {
    setSaving(true)
    const { error } = await setAiConsent(true)
    setSaving(false)
    if (error) {
      toast.error('Couldn’t save that. Try again.')
      return
    }
    track('ai_consent_changed', { granted: true, from: 'prompt' })
    settle(true)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allow AI features?</DialogTitle>
          <DialogDescription>
            To draft messages, prep for chats, read business cards and suggest who to reach out
            to, Retrn sends the details a feature needs to{' '}
            <span className="font-medium text-foreground">Anthropic’s Claude</span> for
            processing.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-text-secondary">
          <li>
            That can include names, companies, notes and dates about people in your network, and
            what you type or say.
          </li>
          <li>It is not used to train AI models, and nothing is saved until you confirm it.</li>
          <li>You can turn this off any time in Settings → Privacy.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Details in the{' '}
          <Link to={ROUTES.privacy} className="text-brand" onClick={() => settle(false)}>
            Privacy Policy
          </Link>
          .
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => settle(false)}>
            Not now
          </Button>
          <Button onClick={() => void allow()} disabled={saving}>
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
