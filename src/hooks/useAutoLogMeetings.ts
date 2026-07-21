import * as React from 'react'
import { useEvents } from './useData'
import { contactRepo, eventRepo } from '@/services'

/**
 * Once a scheduled meeting's end time has passed, log it to each linked
 * contact's interaction timeline and flag the event so it only happens once.
 *
 * There's no server cron, so this runs when the app is open — a meeting that
 * ended while you were away gets logged the next time you visit.
 */
export function useAutoLogMeetings() {
  const events = useEvents()
  const running = React.useRef(false)

  React.useEffect(() => {
    if (!events || running.current) return
    const now = new Date().toISOString()
    const due = events.filter(
      (e) => !e.logged && e.endsAt < now && e.contactIds.length > 0,
    )
    if (due.length === 0) return

    running.current = true
    void (async () => {
      for (const e of due) {
        for (const contactId of e.contactIds) {
          try {
            await contactRepo.addInteraction(contactId, {
              date: e.startsAt.slice(0, 10),
              type: 'meeting',
              summary: e.title,
            })
          } catch (err) {
            // A deleted contact shouldn't block the rest of the batch.
            console.error('Could not log meeting to contact', contactId, err)
          }
        }
        try {
          await eventRepo.update(e.id, { logged: true })
        } catch (err) {
          console.error('Could not flag meeting as logged', e.id, err)
        }
      }
      running.current = false
    })()
  }, [events])
}
