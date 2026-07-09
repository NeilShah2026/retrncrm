import type { User } from '@supabase/supabase-js'
import type { ContactDraft } from '@/services/types'

/**
 * A person's own shareable profile — the "digital business card" encoded into
 * a QR link. Stored in Supabase auth user_metadata (no table needed) and
 * packed into the /add link so a scan can add them to someone's network.
 */
export interface ShareProfile {
  name: string
  headline?: string
  company?: string
  school?: string
  gradYear?: string
  major?: string
  linkedinUrl?: string
  twitter?: string
  website?: string
  email?: string
  phone?: string
}

/** Read the current user's saved share profile out of their auth metadata. */
export function readProfile(user: User | null | undefined): ShareProfile {
  const m = user?.user_metadata ?? {}
  return {
    name: (m.full_name as string | undefined)?.trim() || '',
    headline: (m.headline as string | undefined) ?? '',
    company: (m.company as string | undefined) ?? '',
    // School defaults to the college they picked on the College tab.
    school: (m.profile_school as string | undefined) ?? (m.college as string | undefined) ?? '',
    gradYear: (m.grad_year as string | undefined) ?? '',
    major: (m.major as string | undefined) ?? '',
    linkedinUrl: (m.linkedin_url as string | undefined) ?? '',
    twitter: (m.twitter as string | undefined) ?? '',
    website: (m.website as string | undefined) ?? '',
    email: (m.share_email as string | undefined) ?? '',
    phone: (m.phone as string | undefined) ?? '',
  }
}

/** Flatten a ShareProfile into the user_metadata keys we persist. */
export function profileToMetadata(p: ShareProfile): Record<string, string> {
  return {
    full_name: p.name.trim(),
    headline: p.headline?.trim() ?? '',
    company: p.company?.trim() ?? '',
    profile_school: p.school?.trim() ?? '',
    grad_year: p.gradYear?.trim() ?? '',
    major: p.major?.trim() ?? '',
    linkedin_url: p.linkedinUrl?.trim() ?? '',
    twitter: p.twitter?.trim() ?? '',
    website: p.website?.trim() ?? '',
    share_email: p.email?.trim() ?? '',
    phone: p.phone?.trim() ?? '',
  }
}

// --- Compact encoding for the QR/link ------------------------------------
// Short keys keep the URL small enough to scan reliably.

const KEY_MAP: Record<keyof ShareProfile, string> = {
  name: 'n',
  headline: 'h',
  company: 'c',
  school: 's',
  gradYear: 'g',
  major: 'm',
  linkedinUrl: 'l',
  twitter: 't',
  website: 'w',
  email: 'e',
  phone: 'p',
}

function toBase64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(b64)))
}

/** Encode a profile into a compact URL-safe token. */
export function encodeProfile(p: ShareProfile): string {
  const short: Record<string, string> = {}
  for (const [key, shortKey] of Object.entries(KEY_MAP) as [keyof ShareProfile, string][]) {
    const val = p[key]?.trim()
    if (val) short[shortKey] = val
  }
  return toBase64Url(JSON.stringify(short))
}

/** Decode a token back into a profile. Returns null if malformed. */
export function decodeProfile(token: string): ShareProfile | null {
  try {
    const short = JSON.parse(fromBase64Url(token)) as Record<string, string>
    const reverse = Object.fromEntries(
      Object.entries(KEY_MAP).map(([k, v]) => [v, k]),
    ) as Record<string, keyof ShareProfile>
    const p: ShareProfile = { name: '' }
    for (const [shortKey, val] of Object.entries(short)) {
      const key = reverse[shortKey]
      if (key) p[key] = val
    }
    return p.name ? p : null
  } catch {
    return null
  }
}

/** Build the full shareable URL for a profile. */
export function buildShareUrl(p: ShareProfile, origin: string): string {
  return `${origin}/add#${encodeProfile(p)}`
}

/** Map a received profile into a ContactDraft to save into the network. */
export function profileToContactDraft(p: ShareProfile): ContactDraft {
  const [firstName, ...rest] = p.name.trim().split(/\s+/)
  const otherLinks = p.website?.trim()
    ? [{ id: crypto.randomUUID(), label: 'Website', url: p.website.trim() }]
    : []
  return {
    firstName: firstName ?? p.name.trim(),
    lastName: rest.join(' '),
    jobTitle: p.headline?.trim() || undefined,
    company: p.company?.trim() || undefined,
    school: p.school?.trim() || undefined,
    gradYear: p.gradYear?.trim() || undefined,
    major: p.major?.trim() || undefined,
    linkedinUrl: p.linkedinUrl?.trim() || undefined,
    twitter: p.twitter?.trim() || undefined,
    email: p.email?.trim() || undefined,
    phone: p.phone?.trim() || undefined,
    otherLinks,
    tagIds: [],
    relationshipStrength: 3,
    contactFrequencyGoal: 'none',
    source: 'networking-event',
    howWeMet: 'Connected via Retrn profile',
  }
}
