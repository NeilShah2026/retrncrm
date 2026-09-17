import * as React from 'react'
import { InsetRow } from '@/components/ui/inset-list'
import {
  ensureReminderPermission,
  reminderPermission,
  type ReminderPermission,
} from '@/lib/reminderNotifications'

/**
 * Whether follow-up and birthday notifications can reach this phone, and the
 * one tap that asks. iOS only lets an app ask once; after a "Don't Allow" the
 * switch lives in the Settings app, so the row says where.
 */
export function ReminderSettingsRow({ icon }: { icon: React.ReactNode }) {
  const [state, setState] = React.useState<ReminderPermission | null>(null)

  React.useEffect(() => {
    void reminderPermission().then(setState)
  }, [])

  const detail =
    state === 'granted' ? 'On' : state === 'denied' ? 'Off' : state === 'prompt' ? 'Not set up' : ''

  return (
    <InsetRow
      leading={icon}
      title="Notifications"
      subtitle={state === 'denied' ? 'Turn on in Settings → Retrn → Notifications' : undefined}
      detail={detail}
      chevron={state === 'prompt'}
      last
      onClick={
        state === 'prompt' ? () => void ensureReminderPermission().then(setState) : undefined
      }
    />
  )
}
