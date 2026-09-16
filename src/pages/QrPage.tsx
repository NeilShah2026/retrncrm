import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, Copy, GraduationCap, Link2, Mail, Phone, Share, UserPlus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BackBarButton } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/inset-list'
import { QrScanner } from '@/components/profile/QrScanner'
import { useAuth } from '@/auth/AuthProvider'
import { contactRepo } from '@/services'
import { apiOrigin } from '@/lib/apiBase'
import { avatarColor } from '@/lib/format'
import { successFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import {
  buildShareUrl,
  decodeProfile,
  profileToContactDraft,
  readProfile,
  type ShareProfile,
} from '@/lib/shareProfile'
import { cn } from '@/lib/utils'

type Mode = 'mine' | 'scan'

/**
 * The QR screen: your own code on one side, the camera on the other.
 *
 * A scanned Retrn code never leaves the app — the profile is encoded in the
 * link itself, so it is decoded here and saved straight to the network. The
 * `/add` web page is for people who *don't* have Retrn and scan with the
 * system camera.
 */
export function QrPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = React.useState<Mode>('mine')
  const [scanned, setScanned] = React.useState<ShareProfile | null>(null)
  const [scanError, setScanError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const profile = readProfile(user)
  const url = buildShareUrl(profile, apiOrigin())

  function handleScan(text: string) {
    const found = profileFromScan(text)
    if (!found) {
      setScanError('That isn’t a Retrn code. Ask them to open Retrn → QR code.')
      return
    }
    successFeedback()
    setScanError(null)
    setScanned(found)
  }

  async function add() {
    if (!scanned) return
    setSaving(true)
    try {
      const [firstName, ...rest] = scanned.name.trim().split(/\s+/)
      const existing = await contactRepo.findDuplicates(
        firstName ?? scanned.name,
        rest.join(' '),
        scanned.company,
      )
      if (existing.length > 0) {
        toast.success(`${scanned.name} is already in your network`)
        navigate(ROUTES.contact(existing[0].id))
        return
      }
      const created = await contactRepo.create(profileToContactDraft(scanned))
      toast.success(`Added ${scanned.name}`)
      navigate(ROUTES.contact(created.id))
    } catch (err) {
      console.error(err)
      toast.error('Could not add this person.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell
      mobile={{ title: 'QR Code', largeTitle: false, leading: <BackBarButton label="Home" /> }}
      header={
        <PageHeader
          title="QR code"
          description="Hand someone your profile, or scan theirs to add them."
        />
      }
      bodyClassName="bg-grouped"
    >
      <div className="mx-auto w-full max-w-md space-y-5">
        <SegmentedControl
          label="QR code"
          value={mode}
          onChange={(next) => {
            setMode(next)
            setScanned(null)
            setScanError(null)
          }}
          options={[
            { value: 'mine', label: 'My code' },
            { value: 'scan', label: 'Scan' },
          ]}
        />

        {mode === 'mine' ? (
          <MyCode profile={profile} url={url} onEdit={() => navigate(ROUTES.settings)} />
        ) : scanned ? (
          <ScannedProfile
            profile={scanned}
            saving={saving}
            onAdd={() => void add()}
            onAgain={() => setScanned(null)}
          />
        ) : (
          <div className="space-y-3">
            <QrScanner onScan={handleScan} />
            {scanError && (
              <p className="text-ios-footnote rounded-[12px] bg-warning-soft px-4 py-3 text-warning">
                {scanError}
              </p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}

/** Your own code, big enough to scan off the screen. */
function MyCode({
  profile,
  url,
  onEdit,
}: {
  profile: ShareProfile
  url: string
  onEdit: () => void
}) {
  const [copied, setCopied] = React.useState(false)
  const subtitle = [profile.headline, profile.company].filter(Boolean).join(' · ')
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Retrn', text: `${profile.name} on Retrn`, url })
    } catch {
      // Dismissed, or the sheet is unavailable — nothing to report.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center rounded-[14px] bg-grouped-cell p-6">
        <div className="rounded-[12px] bg-white p-4">
          <QRCodeSVG value={url} size={216} level="M" marginSize={0} fgColor="#111113" bgColor="#ffffff" />
        </div>
        <p className="text-ios-title3 mt-4 text-center">{profile.name || 'Your name'}</p>
        {subtitle && (
          <p className="text-ios-subhead mt-0.5 text-center text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {canShare && (
          <Button variant="outline" className="h-11 rounded-[12px]" onClick={() => void share()}>
            <Share />
            Share
          </Button>
        )}
        <Button
          variant="outline"
          className={cn('h-11 rounded-[12px]', !canShare && 'col-span-2')}
          onClick={() => void copy()}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>

      <p className="text-ios-footnote px-1 text-center text-muted-foreground">
        Anyone can scan this with their camera — they don’t need Retrn.{' '}
        <button type="button" onClick={onEdit} className="text-brand">
          Edit what’s shared
        </button>
      </p>
    </div>
  )
}

/** Who the code belongs to, and the one button that matters. */
function ScannedProfile({
  profile,
  saving,
  onAdd,
  onAgain,
}: {
  profile: ShareProfile
  saving: boolean
  onAdd: () => void
  onAgain: () => void
}) {
  const rows: { icon: typeof Mail; text: string }[] = []
  if (profile.school) {
    rows.push({
      icon: GraduationCap,
      text: [profile.school, profile.gradYear && `’${profile.gradYear.slice(-2)}`]
        .filter(Boolean)
        .join(' '),
    })
  }
  if (profile.major) rows.push({ icon: GraduationCap, text: profile.major })
  if (profile.email) rows.push({ icon: Mail, text: profile.email })
  if (profile.phone) rows.push({ icon: Phone, text: profile.phone })
  if (profile.linkedinUrl) rows.push({ icon: Link2, text: 'LinkedIn' })
  if (profile.website) rows.push({ icon: Link2, text: profile.website.replace(/^https?:\/\//, '') })

  const subtitle = [profile.headline, profile.company].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-grouped-cell p-5">
        <div className="flex items-center gap-3.5">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[19px] font-semibold',
              avatarColor(profile.name),
            )}
          >
            {initialsOf(profile.name)}
          </span>
          <div className="min-w-0">
            <p className="text-ios-title3 truncate">{profile.name}</p>
            {subtitle && (
              <p className="text-ios-subhead truncate text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {rows.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-border/60 pt-4">
            {rows.map((row) => (
              <li key={row.text} className="text-ios-subhead flex items-center gap-2.5">
                <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{row.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button className="text-ios-headline h-11 w-full rounded-[12px]" onClick={onAdd} loading={saving}>
        <UserPlus />
        Add to Retrn
      </Button>
      <button type="button" onClick={onAgain} className="press text-ios-subhead w-full text-center text-brand">
        Scan another
      </button>
    </div>
  )
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * A scanned string as a profile: our share links carry it in the fragment
 * (`/add#token`), older ones in `?c=`, and a bare token scans fine too.
 * Anything else — a website, a wifi code — is not ours.
 */
function profileFromScan(raw: string): ShareProfile | null {
  const text = raw.trim()
  try {
    const url = new URL(text)
    const token = url.hash.replace(/^#/, '') || url.searchParams.get('c') || ''
    if (token) return decodeProfile(token)
    return null
  } catch {
    return decodeProfile(text)
  }
}
