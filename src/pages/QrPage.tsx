import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Check,
  Copy,
  GraduationCap,
  Link2,
  Mail,
  Phone,
  Share,
  UserPlus,
} from 'lucide-react'
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
import { track } from '@/lib/analytics'
import { avatarColor, formatDate } from '@/lib/format'
import { successFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import {
  buildShareUrl,
  decodeProfile,
  profileToContactDraft,
  readProfile,
  type ShareProfile,
} from '@/lib/shareProfile'
import {
  cardUrl,
  claimHandoffs,
  fetchMyCard,
  publishCard,
  resolveCard,
  slugFromLink,
  type Handoff,
  type MyCard,
} from '@/lib/sharedCard'
import { cn } from '@/lib/utils'
import { isContactLimitError } from '@/lib/billing/contactLimit'

type Mode = 'mine' | 'scan'

/**
 * The QR screen: your own code on one side, the camera on the other.
 *
 * The code points at a short link (`/c/<slug>`) once the card has been
 * published, and at the self-contained `/add#<token>` link otherwise. Both
 * land on the same public page, which is what someone without Retrn sees
 * when they scan with the system camera; the difference is that a published
 * card can count its scans and can carry someone's details back.
 *
 * Scanning, either way, is resolved here and saved straight to the network.
 */
export function QrPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = React.useState<Mode>('mine')
  const [scanned, setScanned] = React.useState<ShareProfile | null>(null)
  const [scanError, setScanError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [card, setCard] = React.useState<MyCard | null>(null)
  const [handoffs, setHandoffs] = React.useState<Handoff[]>([])

  const profile = readProfile(user)

  /**
   * Publishing happens on arrival rather than behind a button: the card is
   * only ever a copy of the profile, and a "publish" people have to remember
   * is a card that silently goes stale. The slug is assigned once and kept,
   * so a printed link keeps working however often this runs.
   *
   * All of it fails soft — no endpoint, no migration, no network, and the QR
   * code below simply falls back to the self-contained link.
   */
  const profileKey = JSON.stringify(profile)
  React.useEffect(() => {
    let live = true
    void (async () => {
      const slug = await publishCard(profile)
      if (!live) return
      if (slug) track('card_published')
      const mine = await fetchMyCard()
      if (!live || !mine) return
      setCard(mine.card)
      setHandoffs(mine.handoffs)
    })()
    return () => {
      live = false
    }
    // Keyed on the profile's contents, not its identity: `readProfile` builds
    // a fresh object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey])

  const url = card ? cardUrl(card.slug, apiOrigin()) : buildShareUrl(profile, apiOrigin())

  async function handleScan(text: string) {
    const found = profileFromScan(text)
    if (found) {
      successFeedback()
      setScanError(null)
      setScanned(found)
      return
    }
    // A short link carries nothing but the slug, so it has to be looked up.
    const slug = slugFromLink(text)
    const resolved = slug ? await resolveCard(slug) : null
    if (!resolved) {
      setScanError('That isn’t a Retrn code. Ask them to open Retrn → QR code.')
      return
    }
    successFeedback()
    setScanError(null)
    setScanned(resolved)
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
      // The upgrade prompt is already up; a second error would just be noise.
      if (isContactLimitError(err)) return
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
          <>
            <MyCode
              profile={profile}
              url={url}
              card={card}
              onEdit={() => navigate(ROUTES.settings)}
            />
            <HandoffInbox
              handoffs={handoffs}
              onResolved={(id) => setHandoffs((rest) => rest.filter((h) => h.id !== id))}
            />
          </>
        ) : scanned ? (
          <ScannedProfile
            profile={scanned}
            saving={saving}
            onAdd={() => void add()}
            onAgain={() => setScanned(null)}
          />
        ) : (
          <div className="space-y-3">
            <QrScanner onScan={(text) => void handleScan(text)} />
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
  card,
  onEdit,
}: {
  profile: ShareProfile
  url: string
  /** Null until the card is published — or for good, if it can't be. */
  card: MyCard | null
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
        {card && (
          <p className="text-ios-footnote mt-3 text-center text-muted-foreground">
            {url.replace(/^https?:\/\/(www\.)?/, '')}
          </p>
        )}
      </div>

      {card && card.scanCount > 0 && (
        <p className="text-ios-footnote px-1 text-center text-muted-foreground">
          <span className="tnum text-foreground">{card.scanCount}</span>{' '}
          {card.scanCount === 1 ? 'scan' : 'scans'} ·{' '}
          <span className="tnum text-foreground">{card.saveCount}</span> saved you to their
          phone
        </p>
      )}

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

/**
 * Details people sent back after scanning your card.
 *
 * They wait here rather than appearing in Contacts on their own: anyone
 * holding the link can send one, so accepting is a decision, not a default.
 * It is also the reason to open this screen again after an event — which is
 * the point of the whole exchange.
 */
function HandoffInbox({
  handoffs,
  onResolved,
}: {
  handoffs: Handoff[]
  onResolved: (id: string) => void
}) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  if (handoffs.length === 0) return null

  async function accept(handoff: Handoff) {
    setBusyId(handoff.id)
    try {
      const [firstName, ...rest] = handoff.name.trim().split(/\s+/)
      const created = await contactRepo.create({
        firstName: firstName ?? handoff.name.trim(),
        lastName: rest.join(' '),
        jobTitle: handoff.headline,
        company: handoff.company,
        school: handoff.school,
        email: handoff.email,
        phone: handoff.phone,
        otherLinks: [],
        tagIds: [],
        relationshipStrength: 3,
        contactFrequencyGoal: 'none',
        source: 'networking-event',
        howWeMet: handoff.note
          ? `Sent their details after scanning my code — ${handoff.note}`
          : 'Sent their details after scanning my code',
        whereWeMet: handoff.whereWeMet,
        dateMet: handoff.metOn,
      })
      await claimHandoffs([handoff.id])
      track('card_handoff_accepted')
      onResolved(handoff.id)
      toast.success(`Added ${handoff.name}`)
      navigate(ROUTES.contact(created.id))
    } catch (err) {
      // The upgrade prompt is already up; a second error would just be noise.
      if (isContactLimitError(err)) return
      console.error(err)
      toast.error('Could not add this person.')
    } finally {
      setBusyId(null)
    }
  }

  async function dismiss(handoff: Handoff) {
    setBusyId(handoff.id)
    await claimHandoffs([handoff.id])
    onResolved(handoff.id)
    setBusyId(null)
  }

  return (
    <div className="space-y-2.5">
      <p className="text-ios-footnote px-1 text-muted-foreground">
        Sent to you ({handoffs.length})
      </p>
      {handoffs.map((handoff) => {
        const meta = [handoff.headline, handoff.company, handoff.school]
          .filter(Boolean)
          .join(' · ')
        const reach = [handoff.email, handoff.phone].filter(Boolean).join(' · ')
        const met = [handoff.whereWeMet, handoff.metOn && formatDate(handoff.metOn)]
          .filter(Boolean)
          .join(' · ')
        return (
          <div key={handoff.id} className="rounded-[14px] bg-grouped-cell p-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold',
                  avatarColor(handoff.name),
                )}
              >
                {initialsOf(handoff.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ios-headline truncate">{handoff.name}</p>
                {meta && (
                  <p className="text-ios-subhead truncate text-muted-foreground">{meta}</p>
                )}
                {reach && (
                  <p className="text-ios-subhead mt-1 truncate text-text-secondary">{reach}</p>
                )}
              </div>
            </div>
            {handoff.note && (
              <p className="text-ios-subhead mt-3 border-t border-border/60 pt-3 text-text-secondary">
                {handoff.note}
              </p>
            )}
            {met && <p className="text-ios-footnote mt-2 text-muted-foreground">{met}</p>}
            <div className="mt-3 flex gap-2.5">
              <Button
                className="h-10 flex-1 rounded-[12px]"
                loading={busyId === handoff.id}
                onClick={() => void accept(handoff)}
              >
                <UserPlus />
                Add
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-[12px]"
                disabled={busyId === handoff.id}
                onClick={() => void dismiss(handoff)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )
      })}
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
