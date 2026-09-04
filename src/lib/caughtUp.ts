import { toast } from 'sonner'
import { contactRepo } from '@/services'
import { todayISO } from './format'
import type { Contact } from '@/types'

/**
 * "We spoke today" in one tap.
 *
 * This replaced hand-written interaction logging: the reconnect engine only
 * ever reads `lastContactDate` (see lib/reconnect.ts), so asking someone to
 * type up what was said in order to reset a nudge was pure friction for a
 * single date field. Anything worth writing down still belongs in notes.
 */
export async function markCaughtUp(contact: Contact): Promise<void> {
  const today = todayISO()
  if (contact.lastContactDate === today) {
    toast.info(`Already caught up with ${contact.firstName} today`)
    return
  }
  try {
    await contactRepo.update(contact.id, { lastContactDate: today })
    toast.success(`Caught up with ${contact.firstName} — reconnect clock reset`)
  } catch (err) {
    console.error(err)
    toast.error('Could not update the last-contact date.')
  }
}
