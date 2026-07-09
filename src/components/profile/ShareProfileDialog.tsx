import * as React from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Check, Copy, Settings2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthProvider'
import { readProfile, buildShareUrl } from '@/lib/shareProfile'
import { ROUTES } from '@/lib/routes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Shows the signed-in user's profile as a scannable QR code. The whole
 * profile is encoded into the link itself — no server involved — so anyone
 * who scans it lands on /add with the details ready to save to their network.
 */
export function ShareProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth()
  const [copied, setCopied] = React.useState(false)

  const profile = readProfile(user)
  const url = buildShareUrl(profile, window.location.origin)

  const subtitle = [profile.headline, profile.company].filter(Boolean).join(' · ')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share your profile</DialogTitle>
          <DialogDescription>
            Have someone scan this to add you to their network.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <QRCodeSVG
              value={url}
              size={208}
              level="M"
              marginSize={0}
              fgColor="#0b0b12"
              bgColor="#ffffff"
            />
          </div>

          <p className="mt-4 text-base font-semibold">{profile.name || 'Your name'}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}

          <div className="mt-5 flex w-full items-center gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={copyLink}>
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
            <Button variant="ghost" size="icon" asChild aria-label="Edit profile">
              <Link to={ROUTES.settings} onClick={() => onOpenChange(false)}>
                <Settings2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Link
            to={ROUTES.settings}
            onClick={() => onOpenChange(false)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Edit your shareable profile in Settings
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
