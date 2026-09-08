import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Briefcase, GraduationCap, Link2, Mail, Phone, UserPlus } from 'lucide-react'
import { Logo } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthProvider'
import { contactRepo } from '@/services'
import { decodeProfile, profileToContactDraft, type ShareProfile } from '@/lib/shareProfile'
import { avatarColor } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** The landing for a scanned profile QR: who they are, and one button. */
export function AddContactPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = React.useState(false)

  const profile: ShareProfile | null = React.useMemo(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const query = new URLSearchParams(window.location.search).get('c') ?? ''
    return decodeProfile(hash || query)
  }, [])

  async function handleAdd() {
    if (!profile) return
    setSaving(true)
    try {
      const [firstName, ...rest] = profile.name.trim().split(/\s+/)
      const dupes = await contactRepo.findDuplicates(firstName ?? profile.name, rest.join(' '), profile.company)
      if (dupes.length > 0) {
        toast.success(`${profile.name} is already in your network`)
        navigate(ROUTES.contact(dupes[0].id))
        return
      }
      const created = await contactRepo.create(profileToContactDraft(profile))
      toast.success(`Added ${profile.name}`)
      navigate(ROUTES.contact(created.id))
    } catch (err) {
      console.error(err)
      toast.error('Could not add this person.')
    } finally {
      setSaving(false)
    }
  }

  function handleSignIn() {
    const next = window.location.pathname + window.location.hash
    navigate(`${ROUTES.login}?next=${encodeURIComponent(next)}`)
  }

  type Row = { icon: typeof Mail; text: string }
  const rows: Row[] = []
  if (profile) {
    if (profile.school) {
      rows.push({
        icon: GraduationCap,
        text: [profile.school, profile.gradYear && `’${profile.gradYear.slice(-2)}`].filter(Boolean).join(' '),
      })
    }
    if (profile.major) rows.push({ icon: GraduationCap, text: profile.major })
    if (profile.linkedinUrl) rows.push({ icon: Link2, text: 'LinkedIn' })
    if (profile.website) rows.push({ icon: Link2, text: profile.website.replace(/^https?:\/\//, '') })
    if (profile.email) rows.push({ icon: Mail, text: profile.email })
    if (profile.phone) rows.push({ icon: Phone, text: profile.phone })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link to={ROUTES.home} className="inline-block rounded-sm">
          <Logo />
        </Link>

        <div className="mt-8 rounded-lg border p-6">
          {!profile ? (
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.02em]">This link looks broken</h1>
              <p className="mt-2 text-sm text-muted-foreground">Ask them to share their Retrn profile again.</p>
              <Button variant="outline" size="sm" asChild className="mt-5">
                <Link to={ROUTES.home}>Go to Retrn</Link>
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-medium',
                    avatarColor(profile.name),
                  )}
                >
                  {initialsOf(profile.name)}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-[-0.02em]">{profile.name}</h1>
                  {(profile.headline || profile.company) && (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-text-secondary">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {[profile.headline, profile.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              {rows.length > 0 && (
                <ul className="mt-5 space-y-2 border-t pt-4">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-text-secondary">
                      <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{r.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6">
                {loading ? null : user ? (
                  <Button onClick={handleAdd} loading={saving} size="lg" className="w-full">
                    {!saving && <UserPlus />}
                    Add to my network
                  </Button>
                ) : (
                  <Button onClick={handleSignIn} size="lg" className="w-full">
                    Sign in to add {profile.name.split(/\s+/)[0]}
                  </Button>
                )}
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Saved to your own private Retrn network.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
