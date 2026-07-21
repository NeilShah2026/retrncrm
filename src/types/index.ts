/**
 * Domain types for the personal CRM. These describe the shape of the data as
 * the UI understands it — the persistence layer (Supabase/Postgres) is
 * responsible for storing/retrieving objects in this shape.
 */

export type InteractionType =
  | 'call'
  | 'email'
  | 'coffee'
  | 'text'
  | 'event'
  | 'meeting'
  | 'linkedin'
  | 'other'

export interface Interaction {
  id: string
  /** ISO date string (yyyy-mm-dd) */
  date: string
  type: InteractionType
  summary: string
  createdAt: string
  /** Optional deep link back to the source (e.g. an email thread or LinkedIn). */
  link?: string
}

export interface OtherLink {
  id: string
  label: string
  url: string
}

/** Preset cadence goals. Mapped to concrete day counts in lib/reconnect.ts. */
export type ContactFrequency =
  | 'none'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'biannually'
  | 'annually'

/** How a person relates to you — tuned for a student's network. */
export type ConnectionType =
  | 'recruiter'
  | 'professor'
  | 'alumni'
  | 'classmate'
  | 'founder'
  | 'mentor'
  | 'investor'
  | 'peer'
  | 'other'

/** Where/how you came across someone — campus-life oriented. */
export type MeetSource =
  | 'career-fair'
  | 'class'
  | 'club'
  | 'networking-event'
  | 'guest-lecture'
  | 'hackathon'
  | 'info-session'
  | 'coffee-chat'
  | 'referral'
  | 'online'
  | 'travel'
  | 'other'

export interface Contact {
  id: string
  firstName: string
  lastName: string
  /** Data URL or remote URL for a photo. Absent → initials avatar. */
  photo?: string

  company?: string
  jobTitle?: string
  industry?: string

  linkedinUrl?: string
  email?: string
  phone?: string
  twitter?: string
  otherLinks: OtherLink[]

  // Student-centered context
  connectionType?: ConnectionType
  school?: string
  gradYear?: string
  major?: string
  source?: MeetSource
  /** contactId of whoever introduced this person to you (warm-intro graph). */
  introducedById?: string
  /** Editable talking points surfaced in coffee-chat prep. */
  talkingPoints?: string

  howWeMet?: string
  whereWeMet?: string
  /** ISO date string (yyyy-mm-dd) */
  dateMet?: string

  tagIds: string[]
  /** 1–5 */
  relationshipStrength: number

  /** ISO date string (yyyy-mm-dd) */
  lastContactDate?: string
  contactFrequencyGoal: ContactFrequency

  /** Markdown source */
  notes?: string

  interactions: Interaction[]

  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  /** Key into TAG_COLORS */
  color: string
  createdAt: string
}

/** Payload for creating a contact — only what's genuinely required. */
export interface NewContactInput {
  firstName: string
  lastName?: string
  company?: string
  howWeMet?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Recruiting pipeline
// ---------------------------------------------------------------------------

export type OpportunityStage =
  | 'researching'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'closed'

export type OpportunityType =
  | 'internship'
  | 'full-time'
  | 'co-op'
  | 'research'
  | 'part-time'
  | 'other'

export type OpportunityOutcome =
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted'

export interface Opportunity {
  id: string
  company: string
  role: string
  type: OpportunityType
  stage: OpportunityStage
  /** Set when stage === 'closed' to record how it ended. */
  outcome?: OpportunityOutcome
  location?: string
  /** Job posting URL */
  link?: string
  /** ISO date — application deadline */
  deadline?: string
  /** ISO date — when you applied */
  appliedDate?: string
  /** Markdown */
  notes?: string
  /** Linked contacts (recruiter, referrer, hiring manager…). */
  contactIds: string[]
  /** Manual ordering within a stage column. */
  order: number
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** A scheduled meeting/event, optionally with people from your network. */
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  /** Physical place or a meeting link (Zoom, Meet…). */
  location?: string
  /** ISO datetime */
  startsAt: string
  /** ISO datetime */
  endsAt: string
  allDay: boolean
  /** Contacts this meeting is with. */
  contactIds: string[]
  /** True once the past meeting has been logged to those contacts' timelines. */
  logged: boolean
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Outreach templates
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'cold-intro'
  | 'thank-you'
  | 'coffee-chat'
  | 'follow-up'
  | 'referral-ask'
  | 'other'

export interface OutreachTemplate {
  id: string
  name: string
  category: TemplateCategory
  subject?: string
  /** Body with {{firstName}}, {{company}}, {{myName}} style placeholders. */
  body: string
  createdAt: string
  updatedAt: string
}
