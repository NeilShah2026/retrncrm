import * as React from 'react'
import { toast } from 'sonner'
import { Check, Copy, RefreshCw, CalendarCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Shows the user's personal iCal subscribe link. Google/Apple/Outlook poll
 * this URL, so the calendar stays in sync as meetings change.
 */
export function CalendarSyncDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth()
  const [token, setToken] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [copied, setCopied] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    // One token per user — fetch it, or mint one on first use.
    const { data } = await supabase
      .from('calendar_tokens')
      .select('token')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data?.token) {
      setToken(data.token)
    } else {
      const { data: created, error } = await supabase
        .from('calendar_tokens')
        .insert({ user_id: user.id })
        .select('token')
        .single()
      if (error) toast.error('Could not create your calendar link.')
      else setToken(created.token)
    }
    setLoading(false)
  }, [user])

  React.useEffect(() => {
    if (open) void load()
  }, [open, load])

  const httpsUrl = token ? `${window.location.origin}/api/calendar?token=${token}` : ''
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  async function reset() {
    if (!user) return
    setLoading(true)
    await supabase.from('calendar_tokens').delete().eq('user_id', user.id)
    setToken(null)
    await load()
    toast.success('New link created — the old one no longer works.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to your calendar</DialogTitle>
          <DialogDescription>
            Add this link to Google, Apple, or Outlook Calendar and your Retrn
            meetings stay in sync automatically.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                {httpsUrl}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => void copy()} className="flex-1 gap-2">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy link
                  </>
                )}
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <a href={webcalUrl}>
                  <CalendarCheck className="h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>

            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">How to add it</p>
              <p>
                <strong>Google Calendar:</strong> Other calendars → + → From URL →
                paste.
                <br />
                <strong>Apple Calendar:</strong> File → New Calendar Subscription →
                paste.
                <br />
                <strong>Outlook:</strong> Add calendar → Subscribe from web → paste.
              </p>
            </div>

            <div className="flex items-start justify-between gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Anyone with this link can see your meeting times. Reset it if you
                ever share it by accident.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void reset()}
                className="shrink-0 gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
