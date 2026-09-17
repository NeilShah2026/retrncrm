import { toast } from 'sonner'
import { contactRepo, followUpRepo, keyDateRepo } from '@/services'
import { dueInSentence } from '@/lib/followUps'
import { todayISO } from '@/lib/format'
import { successFeedback } from '@/lib/haptics'
import { ensureReminderPermission } from '@/lib/reminderNotifications'
import type { ExtractedFollowUp } from '@/lib/followUps'
import type { Contact, FollowUp, KeyDate } from '@/types'

/**
 * Done. Following up *is* getting in touch, so it also resets the reconnect
 * clock — and Undo puts both back exactly as they were.
 */
export async function completeFollowUp(followUp: FollowUp, contact?: Contact): Promise<void> {
  const today = todayISO()
  const previousContactDate = contact?.lastContactDate
  const touchContact = Boolean(contact) && previousContactDate !== today
  try {
    await followUpRepo.update(followUp.id, { completedAt: new Date().toISOString() })
    if (contact && touchContact) {
      await contactRepo.update(contact.id, { lastContactDate: today })
    }
    successFeedback()
    toast.success(contact ? `Followed up with ${contact.firstName}` : 'Follow-up done', {
      action: {
        label: 'Undo',
        onClick: () => {
          void (async () => {
            await followUpRepo.update(followUp.id, { completedAt: undefined })
            if (contact && touchContact) {
              await contactRepo.update(contact.id, { lastContactDate: previousContactDate })
            }
          })().catch(() => toast.error('Couldn’t undo that.'))
        },
      },
    })
  } catch (err) {
    console.error(err)
    toast.error('Couldn’t mark this follow-up done.')
  }
}

export async function snoozeFollowUp(followUp: FollowUp, dueDate: string): Promise<void> {
  try {
    await followUpRepo.update(followUp.id, { dueDate })
    toast.success(`Moved to ${dueInSentence(dueDate)}`)
  } catch (err) {
    console.error(err)
    toast.error('Couldn’t move this follow-up.')
  }
}

/**
 * What a capture sentence promised beyond the contact itself — "email her
 * back in December", "her birthday is March 3" — saved once the contact
 * exists. A failure here never undoes the contact; it's reported and skipped.
 */
export async function saveCaptureReminders(
  contactId: string,
  extras: { followUp?: ExtractedFollowUp; birthday?: Pick<KeyDate, 'month' | 'day' | 'year'> },
): Promise<void> {
  if (!extras.followUp && !extras.birthday) return
  try {
    if (extras.followUp) {
      await followUpRepo.create({
        contactId,
        dueDate: extras.followUp.dueDate,
        note: extras.followUp.note,
      })
    }
    if (extras.birthday) {
      await keyDateRepo.create({ contactId, label: 'Birthday', ...extras.birthday })
    }
    void ensureReminderPermission()
  } catch (err) {
    console.error(err)
    toast.error('Saved the contact, but couldn’t set the reminder.')
  }
}
