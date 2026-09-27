import { toast } from 'sonner'
import { coldTargetRepo, contactRepo } from '@/services'
import { isContactLimitError } from '@/lib/billing/contactLimit'
import { targetName, toContactDraft, withSend } from '@/lib/coldEmail'
import { track } from '@/lib/analytics'
import type { ColdTarget, Contact } from '@/types'

/*
 * What you can do to a cold email target, each with the toast it deserves.
 * Shared by the page and the Inbox so a follow-up logged from either reads
 * the same — and undoes the same.
 */

/**
 * Record an email going out. The editor's draft is what was sent, so it's
 * kept on the send and the editor is cleared for the next one.
 */
export async function logSend(
  target: ColdTarget,
  send: { date: string; subject?: string; body?: string; link?: string },
): Promise<void> {
  const before = {
    sends: target.sends,
    status: target.status,
    nextFollowUp: target.nextFollowUp,
    draftSubject: target.draftSubject,
    draftBody: target.draftBody,
  }
  const isFirst = target.sends.length === 0
  await coldTargetRepo.update(target.id, {
    ...withSend(target, send),
    draftSubject: undefined,
    draftBody: undefined,
  })
  track('cold_email_send_logged', { follow_up: !isFirst, count: target.sends.length + 1 })
  toast.success(isFirst ? `Logged your email to ${target.firstName || targetName(target)}` : 'Follow-up logged', {
    action: {
      label: 'Undo',
      onClick: () => {
        void coldTargetRepo.update(target.id, before).catch(() => toast.error('Couldn’t undo that.'))
      },
    },
  })
}

/** They wrote back. Follow-ups stop; making them a contact is the next step. */
export async function markReplied(
  target: ColdTarget,
  onConvert?: () => void,
): Promise<void> {
  const before = { status: target.status, repliedAt: target.repliedAt, nextFollowUp: target.nextFollowUp }
  await coldTargetRepo.update(target.id, {
    status: 'replied',
    repliedAt: new Date().toISOString(),
    nextFollowUp: undefined,
  })
  track('cold_target_replied', { sends: target.sends.length })
  toast.success(`${target.firstName || targetName(target)} replied`, {
    description: onConvert ? 'Make them a contact to keep in touch from here.' : undefined,
    action: onConvert
      ? { label: 'Make a contact', onClick: onConvert }
      : {
          label: 'Undo',
          onClick: () => {
            void coldTargetRepo.update(target.id, before).catch(() => toast.error('Couldn’t undo that.'))
          },
        },
  })
}

/**
 * Copy them into Contacts, with every email as an interaction, and link the
 * two. Returns the contact, or null when the free contact limit refused it
 * (the upgrade prompt has already opened by then).
 */
export async function convertToContact(target: ColdTarget): Promise<Contact | null> {
  let contact: Contact
  try {
    contact = await contactRepo.create(toContactDraft(target))
  } catch (err) {
    if (isContactLimitError(err)) return null
    throw err
  }
  await coldTargetRepo.update(target.id, {
    status: 'converted',
    contactId: contact.id,
    nextFollowUp: undefined,
    repliedAt: target.repliedAt ?? new Date().toISOString(),
  })
  track('cold_target_converted', { sends: target.sends.length })
  return contact
}
