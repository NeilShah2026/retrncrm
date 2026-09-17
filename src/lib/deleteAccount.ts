import { supabase } from '@/lib/supabase'
import { postApi } from '@/lib/apiFetch'
import { clearSubscriptionCache } from '@/lib/billing/store'
import { clearReminders } from '@/lib/reminderNotifications'

/**
 * Delete this account for good.
 *
 * The App Store requires account deletion to be reachable from inside the app
 * (Guideline 5.1.1(v)), and to really delete — so this calls the server
 * endpoint that removes the `auth.users` row, which cascades every table the
 * account owns. See api/_lib/deleteAccount.ts.
 *
 * Afterwards the local session is torn down too. The account is already gone
 * at that point, so a failure to sign out cleanly must not surface as "your
 * account could not be deleted" — it just means this device is holding a
 * token that no longer resolves to anything.
 */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You’re signed out. Sign in again to delete your account.')

  const res = await postApi('/api/delete-account', {}, { token })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Could not delete your account. Please try again.')
  }

  await clearSubscriptionCache()
  await clearReminders()
  await supabase.auth.signOut().catch(() => {})
}
