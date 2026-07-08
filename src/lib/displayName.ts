import type { User } from '@supabase/supabase-js'

/** The name to show in the UI: their given name if set, else the email's local part. */
export function displayName(user: User | null | undefined): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim()
  if (fullName) return fullName
  return user?.email?.split('@')[0] ?? 'there'
}

export function initialFor(user: User | null | undefined): string {
  return displayName(user)[0]?.toUpperCase() ?? '?'
}
