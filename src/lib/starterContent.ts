import type { Contact, Opportunity, OutreachTemplate, Tag } from '@/types'
import { createId } from './utils'

/**
 * First-run content for a brand-new account. Intentionally minimal — a
 * single, clearly-labeled example contact (so the profile layout isn't a
 * total blank slate) plus a small library of genuinely reusable outreach
 * templates. No fake pipeline data, no roster of invented people. Seeded
 * once per user on their first sign-in (see lib/seedNewUser.ts).
 */

function buildExampleTag(): Tag {
  return {
    id: createId(),
    name: 'Example',
    color: 'slate',
    createdAt: new Date().toISOString(),
  }
}

function buildExampleContact(exampleTagId: string): Contact {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  return {
    id: createId(),
    firstName: 'Jordan',
    lastName: 'Example',
    company: 'Acme University',
    jobTitle: 'Career Advisor',
    industry: 'Education',
    connectionType: 'mentor',
    source: 'coffee-chat',
    otherLinks: [],
    howWeMet:
      "This is an example contact — edit or delete it any time. Add the people you actually meet at career fairs, coffee chats, on a flight, anywhere.",
    whereWeMet: 'Your first coffee chat',
    dateMet: today,
    tagIds: [exampleTagId],
    relationshipStrength: 3,
    lastContactDate: today,
    contactFrequencyGoal: 'quarterly',
    talkingPoints:
      'Talking points and prep notes show up here — try the "Prep" button above.',
    notes:
      '**Tip:** Click **Edit** to change any field, or **Log interaction** to track your next conversation.\n\nDelete this card whenever you\'re ready — from here, or in bulk via *Settings → Clear all data*.',
    interactions: [
      {
        id: createId(),
        date: today,
        type: 'coffee',
        summary: 'Grabbed coffee and talked about internships — this is a sample timeline entry.',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

function buildTemplates(): OutreachTemplate[] {
  const stamp = '2025-01-05T10:00:00Z'
  return [
    {
      id: createId(),
      name: 'Coffee chat request',
      category: 'coffee-chat',
      subject: 'Quick chat about {{company}}?',
      body: `Hi {{firstName}},\n\nIt was great connecting! I'm a student really interested in {{company}} and the work your team is doing. Would you be open to a 15-minute virtual coffee in the next couple of weeks? I'd love to hear how you got into your role and any advice you have.\n\nTotally understand if you're busy — thanks either way!\n\nBest,\n{{myName}}`,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: createId(),
      name: 'Thank you after a chat',
      category: 'thank-you',
      subject: 'Thank you!',
      body: `Hi {{firstName}},\n\nThank you so much for taking the time to chat today — I really appreciated your perspective on {{company}} and the advice on breaking in. I'll definitely follow up on the resources you mentioned.\n\nHope we can stay in touch!\n\nBest,\n{{myName}}`,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: createId(),
      name: 'Referral ask',
      category: 'referral-ask',
      subject: 'Applying to {{company}} — quick favor?',
      body: `Hi {{firstName}},\n\nI'm applying for a role at {{company}} and remembered you're on the team. Would you feel comfortable referring me, or pointing me to the right person? Happy to send my resume and a short blurb to make it easy.\n\nNo worries at all if not — thanks for considering!\n\nBest,\n{{myName}}`,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: createId(),
      name: 'Career fair follow-up',
      category: 'cold-intro',
      subject: 'Following up from the career fair',
      body: `Hi {{firstName}},\n\nWe spoke briefly at the career fair about opportunities at {{company}} — thanks again for your time! I'm very interested in the intern roles you mentioned and wanted to follow up. I've attached my resume; I'd love to be considered.\n\nLooking forward to staying in touch.\n\nBest,\n{{myName}}`,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: createId(),
      name: 'Reconnect / follow-up',
      category: 'follow-up',
      subject: 'Long time — quick hello',
      body: `Hi {{firstName}},\n\nIt's been a while since we last connected! I've been heads-down on school and a few projects, and {{company}} came to mind. Would love to catch up and hear what you've been working on. Any chance you're free for a quick call soon?\n\nBest,\n{{myName}}`,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]
}

export interface StarterContent {
  contacts: Contact[]
  tags: Tag[]
  opportunities: Opportunity[]
  templates: OutreachTemplate[]
}

/** Build the first-run data set for a brand-new account. */
export function buildStarterContent(): StarterContent {
  const tag = buildExampleTag()
  return {
    contacts: [buildExampleContact(tag.id)],
    tags: [tag],
    opportunities: [],
    templates: buildTemplates(),
  }
}
