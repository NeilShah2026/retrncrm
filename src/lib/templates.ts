import type { Contact, OutreachTemplate } from '@/types'

/** Placeholders available when composing from a template. */
export const TEMPLATE_PLACEHOLDERS = [
  { token: '{{firstName}}', label: "Contact's first name" },
  { token: '{{lastName}}', label: "Contact's last name" },
  { token: '{{company}}', label: "Contact's company" },
  { token: '{{myName}}', label: 'Your name' },
] as const

export interface MergeContext {
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'company'> | null
  myName?: string
}

function mergeText(text: string, ctx: MergeContext): string {
  const c = ctx.contact
  return text
    .replaceAll('{{firstName}}', c?.firstName?.trim() || 'there')
    .replaceAll('{{lastName}}', c?.lastName?.trim() || '')
    .replaceAll('{{company}}', c?.company?.trim() || 'your company')
    .replaceAll('{{myName}}', ctx.myName?.trim() || '[Your Name]')
}

export function mergeTemplate(
  template: Pick<OutreachTemplate, 'subject' | 'body'>,
  ctx: MergeContext,
): { subject: string; body: string } {
  return {
    subject: template.subject ? mergeText(template.subject, ctx) : '',
    body: mergeText(template.body, ctx),
  }
}

/** Build a mailto: link with the merged subject/body, capped to a safe length. */
export function buildMailto(
  email: string | undefined,
  subject: string,
  body: string,
): string {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const query = params.toString()
  return `mailto:${email ?? ''}${query ? `?${query}` : ''}`
}

export function contactMergeSource(
  c: Contact,
): Pick<Contact, 'firstName' | 'lastName' | 'company'> {
  return { firstName: c.firstName, lastName: c.lastName, company: c.company }
}
