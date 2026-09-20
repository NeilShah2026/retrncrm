import { AtSign, GraduationCap, Link2, Mail, Phone, Globe } from 'lucide-react'
import { avatarColor } from '@/lib/format'
import type { ShareProfile } from '@/lib/shareProfile'
import { cn } from '@/lib/utils'

/**
 * Someone's card, as the person who just scanned it sees it.
 *
 * This is the only screen in Retrn most of these people will ever look at,
 * and they are looking at it with the person themselves standing in front of
 * them. So it is built to read as *them*, not as a record: their name at
 * display size, the two lines that place them, and then contact rows that
 * are actually tappable — a phone number you can't call is a screenshot.
 */

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

interface Row {
  icon: typeof Mail
  /** What the row is — "Email", "LinkedIn". */
  label: string
  /** What it says — the address, the handle, the domain. */
  value: string
  /** Where tapping goes. */
  href: string
  /** Opens outside the page rather than handing off to another app. */
  external?: boolean
}

function rowsFor(profile: ShareProfile): Row[] {
  const rows: Row[] = []
  if (profile.email) {
    rows.push({ icon: Mail, label: 'Email', value: profile.email, href: `mailto:${profile.email}` })
  }
  if (profile.phone) {
    rows.push({
      icon: Phone,
      label: 'Phone',
      value: profile.phone,
      href: `tel:${profile.phone.replace(/[^\d+]/g, '')}`,
    })
  }
  if (profile.linkedinUrl) {
    rows.push({
      icon: Link2,
      label: 'LinkedIn',
      value: profile.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, ''),
      href: withScheme(profile.linkedinUrl),
      external: true,
    })
  }
  if (profile.twitter) {
    const handle = profile.twitter.replace(/^@/, '')
    rows.push({
      icon: AtSign,
      label: 'X',
      value: `@${handle}`,
      href: `https://x.com/${handle}`,
      external: true,
    })
  }
  if (profile.website) {
    rows.push({
      icon: Globe,
      label: 'Website',
      value: profile.website.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      href: withScheme(profile.website),
      external: true,
    })
  }
  return rows
}

export function ScanCard({ profile }: { profile: ShareProfile }) {
  const rows = rowsFor(profile)
  const role = [profile.headline, profile.company].filter(Boolean).join(' · ')
  const study = [
    profile.school,
    profile.gradYear && `’${profile.gradYear.slice(-2)}`,
    profile.major && `· ${profile.major}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {/* The identity half. A tinted band rather than a second card — the
          separation is a background shift and a hairline, as everywhere. */}
      <div className="border-b bg-bg-sunken/60 px-5 py-6 sm:px-6">
        <span
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full text-[22px] font-semibold',
            avatarColor(profile.name),
          )}
        >
          {initialsOf(profile.name)}
        </span>
        <h1 className="text-display mt-4 text-[1.75rem] leading-[1.15] sm:text-[2rem]">
          {profile.name}
        </h1>
        {role && <p className="mt-2 text-base leading-relaxed text-text-secondary">{role}</p>}
        {study && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span>{study}</span>
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <li key={row.label}>
              <a
                href={row.href}
                {...(row.external && { target: '_blank', rel: 'noreferrer noopener' })}
                className="flex min-h-[52px] items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-sunken/60 active:bg-bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset sm:px-6"
              >
                <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="text-label block text-muted-foreground">{row.label}</span>
                  <span className="block truncate text-sm text-foreground">{row.value}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
