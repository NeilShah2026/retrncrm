import type {
  Contact,
  Interaction,
  Opportunity,
  OutreachTemplate,
  Tag,
} from '@/types'

/**
 * Persistence-agnostic repository contracts. UI code depends only on these
 * interfaces (via hooks), never on Supabase directly — so the storage engine
 * could be swapped by providing new implementations in services/index.ts
 * without touching any component.
 */

export type ContactDraft = Omit<
  Contact,
  'id' | 'createdAt' | 'updatedAt' | 'interactions'
> & {
  interactions?: Interaction[]
}

export type ContactPatch = Partial<Omit<Contact, 'id' | 'createdAt'>>

export interface ContactRepository {
  getAll(): Promise<Contact[]>
  getById(id: string): Promise<Contact | undefined>
  create(draft: ContactDraft): Promise<Contact>
  update(id: string, patch: ContactPatch): Promise<Contact>
  remove(id: string): Promise<void>
  /** Warn-on-add duplicate detection: same name + company (case-insensitive). */
  findDuplicates(
    firstName: string,
    lastName: string,
    company?: string,
    excludeId?: string,
  ): Promise<Contact[]>
  addInteraction(
    contactId: string,
    interaction: Omit<Interaction, 'id' | 'createdAt'>,
  ): Promise<Contact>
  updateInteraction(
    contactId: string,
    interactionId: string,
    patch: Partial<Omit<Interaction, 'id' | 'createdAt'>>,
  ): Promise<Contact>
  removeInteraction(contactId: string, interactionId: string): Promise<Contact>
  /** Bulk replace — used by JSON import. */
  replaceAll(contacts: Contact[]): Promise<void>
  clear(): Promise<void>
}

export type TagDraft = Omit<Tag, 'id' | 'createdAt'>

export interface TagRepository {
  getAll(): Promise<Tag[]>
  create(draft: TagDraft): Promise<Tag>
  update(id: string, patch: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<Tag>
  /** Removes the tag and detaches it from every contact. */
  remove(id: string): Promise<void>
  replaceAll(tags: Tag[]): Promise<void>
  clear(): Promise<void>
}

export type OpportunityDraft = Omit<
  Opportunity,
  'id' | 'createdAt' | 'updatedAt' | 'order'
> & { order?: number }
export type OpportunityPatch = Partial<Omit<Opportunity, 'id' | 'createdAt'>>

export interface OpportunityRepository {
  getAll(): Promise<Opportunity[]>
  getById(id: string): Promise<Opportunity | undefined>
  create(draft: OpportunityDraft): Promise<Opportunity>
  update(id: string, patch: OpportunityPatch): Promise<Opportunity>
  remove(id: string): Promise<void>
  replaceAll(items: Opportunity[]): Promise<void>
  clear(): Promise<void>
}

export type TemplateDraft = Omit<
  OutreachTemplate,
  'id' | 'createdAt' | 'updatedAt'
>
export type TemplatePatch = Partial<Omit<OutreachTemplate, 'id' | 'createdAt'>>

export interface TemplateRepository {
  getAll(): Promise<OutreachTemplate[]>
  create(draft: TemplateDraft): Promise<OutreachTemplate>
  update(id: string, patch: TemplatePatch): Promise<OutreachTemplate>
  remove(id: string): Promise<void>
  replaceAll(items: OutreachTemplate[]): Promise<void>
  clear(): Promise<void>
}
