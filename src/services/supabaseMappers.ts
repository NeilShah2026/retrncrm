import type { Database } from '@/lib/database.types'
import type {
  Contact,
  ConnectionType,
  ContactFrequency,
  Interaction,
  MeetSource,
  Opportunity,
  OpportunityOutcome,
  OpportunityStage,
  OpportunityType,
  OtherLink,
  OutreachTemplate,
  Tag,
  TemplateCategory,
} from '@/types'

type ContactRow = Database['public']['Tables']['contacts']['Row']
type TagRow = Database['public']['Tables']['tags']['Row']
type OpportunityRow = Database['public']['Tables']['opportunities']['Row']
type TemplateRow = Database['public']['Tables']['templates']['Row']

export function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    photo: row.photo ?? undefined,
    company: row.company ?? undefined,
    jobTitle: row.job_title ?? undefined,
    industry: row.industry ?? undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    twitter: row.twitter ?? undefined,
    otherLinks: (row.other_links as OtherLink[] | null) ?? [],
    connectionType: (row.connection_type as ConnectionType | null) ?? undefined,
    school: row.school ?? undefined,
    gradYear: row.grad_year ?? undefined,
    major: row.major ?? undefined,
    source: (row.source as MeetSource | null) ?? undefined,
    introducedById: row.introduced_by_id ?? undefined,
    talkingPoints: row.talking_points ?? undefined,
    howWeMet: row.how_we_met ?? undefined,
    whereWeMet: row.where_we_met ?? undefined,
    dateMet: row.date_met ?? undefined,
    tagIds: row.tag_ids ?? [],
    relationshipStrength: row.relationship_strength,
    lastContactDate: row.last_contact_date ?? undefined,
    contactFrequencyGoal: row.contact_frequency_goal as ContactFrequency,
    notes: row.notes ?? undefined,
    interactions: (row.interactions as Interaction[] | null) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Build a full insert/update row from a Contact-shaped object. */
export function contactToRow(
  userId: string,
  c: Partial<Contact> & { id: string },
): Database['public']['Tables']['contacts']['Insert'] {
  return {
    id: c.id,
    user_id: userId,
    first_name: c.firstName!,
    last_name: c.lastName ?? '',
    photo: c.photo ?? null,
    company: c.company ?? null,
    job_title: c.jobTitle ?? null,
    industry: c.industry ?? null,
    linkedin_url: c.linkedinUrl ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    twitter: c.twitter ?? null,
    other_links: (c.otherLinks ?? []) as unknown as Database['public']['Tables']['contacts']['Row']['other_links'],
    connection_type: c.connectionType ?? null,
    school: c.school ?? null,
    grad_year: c.gradYear ?? null,
    major: c.major ?? null,
    source: c.source ?? null,
    introduced_by_id: c.introducedById ?? null,
    talking_points: c.talkingPoints ?? null,
    how_we_met: c.howWeMet ?? null,
    where_we_met: c.whereWeMet ?? null,
    date_met: c.dateMet ?? null,
    tag_ids: c.tagIds ?? [],
    relationship_strength: c.relationshipStrength ?? 3,
    last_contact_date: c.lastContactDate ?? null,
    contact_frequency_goal: c.contactFrequencyGoal ?? 'none',
    notes: c.notes ?? null,
    interactions: (c.interactions ?? []) as unknown as Database['public']['Tables']['contacts']['Row']['interactions'],
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }
}

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  }
}

export function tagToRow(
  userId: string,
  t: Partial<Tag> & { id: string },
): Database['public']['Tables']['tags']['Insert'] {
  return {
    id: t.id,
    user_id: userId,
    name: t.name!,
    color: t.color ?? 'slate',
    created_at: t.createdAt,
  }
}

export function rowToOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    type: row.type as OpportunityType,
    stage: row.stage as OpportunityStage,
    outcome: (row.outcome as OpportunityOutcome | null) ?? undefined,
    location: row.location ?? undefined,
    link: row.link ?? undefined,
    deadline: row.deadline ?? undefined,
    appliedDate: row.applied_date ?? undefined,
    notes: row.notes ?? undefined,
    contactIds: row.contact_ids ?? [],
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function opportunityToRow(
  userId: string,
  o: Partial<Opportunity> & { id: string },
): Database['public']['Tables']['opportunities']['Insert'] {
  return {
    id: o.id,
    user_id: userId,
    company: o.company!,
    role: o.role!,
    type: o.type ?? 'internship',
    stage: o.stage ?? 'researching',
    outcome: o.outcome ?? null,
    location: o.location ?? null,
    link: o.link ?? null,
    deadline: o.deadline ?? null,
    applied_date: o.appliedDate ?? null,
    notes: o.notes ?? null,
    contact_ids: o.contactIds ?? [],
    order: o.order ?? 0,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  }
}

export function rowToTemplate(row: TemplateRow): OutreachTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category as TemplateCategory,
    subject: row.subject ?? undefined,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function templateToRow(
  userId: string,
  t: Partial<OutreachTemplate> & { id: string },
): Database['public']['Tables']['templates']['Insert'] {
  return {
    id: t.id,
    user_id: userId,
    name: t.name!,
    category: t.category ?? 'other',
    subject: t.subject ?? null,
    body: t.body!,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}
