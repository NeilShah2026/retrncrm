import type { User } from '@supabase/supabase-js'

/**
 * Accounts that see the testing tools in Settings (e.g. previewing the
 * upgrade prompt). Add more with VITE_ADMIN_EMAILS — a comma-separated list,
 * set in Vercel's environment variables. Everyone sees them in `vite dev`.
 */
const ADMIN_EMAILS = [
  'neildshah1013@gmail.com',
  ...(import.meta.env.VITE_ADMIN_EMAILS ?? '').split(','),
]
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdmin(user: User | null | undefined): boolean {
  if (import.meta.env.DEV) return true
  const email = user?.email?.toLowerCase()
  return Boolean(email && ADMIN_EMAILS.includes(email))
}
