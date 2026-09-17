import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts, useFollowUps, useKeyDates } from '@/hooks/useData'
import { retryTable } from '@/lib/loadStatus'
import { isNative } from '@/lib/platform'
import { onReminderTapped, syncReminders } from '@/lib/reminderNotifications'

/**
 * Keeps the phone's scheduled reminders in step with follow-ups and key dates,
 * and opens the right contact when one is tapped. Mounted once, in the app
 * shell; does nothing on the web.
 */
export function useReminderSync() {
  const followUps = useFollowUps()
  const keyDates = useKeyDates()
  const contacts = useContacts()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!isNative || !followUps || !keyDates || !contacts) return
    syncReminders(followUps, keyDates, contacts).catch((err) =>
      console.error('Could not schedule reminders', err),
    )
  }, [followUps, keyDates, contacts])

  React.useEffect(() => {
    if (!isNative) return
    let dispose: (() => void) | undefined
    let cancelled = false
    void onReminderTapped((route) => navigate(route)).then((off) => {
      if (cancelled) off()
      else dispose = off
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [navigate])

  // Something added on the web while the phone was asleep: re-read on resume
  // so the reminder for it gets scheduled without a relaunch.
  React.useEffect(() => {
    if (!isNative) return
    let remove: (() => void) | undefined
    let cancelled = false
    void import('@capacitor/app').then(({ App }) =>
      App.addListener('resume', () => {
        retryTable('follow_ups')
        retryTable('key_dates')
      }).then((handle) => {
        if (cancelled) void handle.remove()
        else remove = () => void handle.remove()
      }),
    )
    return () => {
      cancelled = true
      remove?.()
    }
  }, [])
}
