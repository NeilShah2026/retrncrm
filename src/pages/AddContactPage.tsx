import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
  Link2,
  Mail,
  Phone,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { contactRepo } from '@/services'
import {
  decodeProfile,
  profileToContactDraft,
  type ShareProfile,
} from '@/lib/shareProfile'
import { ROUTES } from '@/lib/routes'

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function AddContactPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = React.useState(false)

  // The profile is encoded in the URL hash (client-side only, never sent to a
  // server). Fall back to a ?c= query param for share surfaces that drop hashes.
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
      const dupes = await contactRepo.findDuplicates(
        firstName ?? profile.name,
        rest.join(' '),
        profile.company,
      )
      if (dupes.length > 0) {
        toast.success(`${profile.name} is already in your network`)
        navigate(ROUTES.contact(dupes[0].id))
        return
      }
      const created = await contactRepo.create(profileToContactDraft(profile))
      toast.success(`Added ${profile.name} to your network`)
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
        text: [profile.school, profile.gradYear && `’${profile.gradYear.slice(-2)}`]
          .filter(Boolean)
          .join(' '),
      })
    }
    if (profile.major) rows.push({ icon: GraduationCap, text: profile.major })
    if (profile.linkedinUrl) rows.push({ icon: Link2, text: 'LinkedIn' })
    if (profile.website)
      rows.push({ icon: Link2, text: profile.website.replace(/^https?:\/\//, '') })
    if (profile.email) rows.push({ icon: Mail, text: profile.email })
    if (profile.phone) rows.push({ icon: Phone, text: profile.phone })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080c] px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/25 blur-[130px]"
      />

      <div className="relative w-full max-w-sm">
        <Link to={ROUTES.home} className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Users className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Retrn</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
          {!profile ? (
            <div className="py-4 text-center">
              <h1 className="font-serif text-xl font-medium text-white">
                This link looks broken
              </h1>
              <p className="mt-2 text-sm text-white/55">
                Ask them to share their Retrn profile again.
              </p>
              <Link
                to={ROUTES.home}
                className="mt-6 inline-block text-xs font-medium text-white/60 hover:text-white"
              >
                ← Go to Retrn
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-lg font-semibold text-white">
                {initialsOf(profile.name)}
              </div>
              <h1 className="mt-4 font-serif text-2xl font-medium text-white">
                {profile.name}
              </h1>
              {(profile.headline || profile.company) && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
                  <Briefcase className="h-3.5 w-3.5" />
                  {[profile.headline, profile.company].filter(Boolean).join(' · ')}
                </p>
              )}

              {rows.length > 0 && (
                <div className="mt-5 w-full space-y-2 border-t border-white/10 pt-5 text-left">
                  {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-white/70">
                      <r.icon className="h-4 w-4 shrink-0 text-white/40" />
                      <span className="truncate">{r.text}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-7 w-full">
                {loading ? null : user ? (
                  <button
                    onClick={handleAdd}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4" />
                    {saving ? 'Adding…' : 'Add to my network'}
                  </button>
                ) : (
                  <button
                    onClick={handleSignIn}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
                  >
                    Sign in to add {profile.name.split(/\s+/)[0]}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="mt-3 text-xs text-white/40">
                  Saving to your own private Retrn network.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
