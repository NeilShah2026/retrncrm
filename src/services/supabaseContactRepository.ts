import { getCurrentUserId, supabase } from '@/lib/supabase'
import { contactToRow, rowToContact } from './supabaseMappers'
import { createId } from '@/lib/utils'
import type { Contact, Interaction } from '@/types'
import type { ContactDraft, ContactPatch, ContactRepository } from './types'

function now(): string {
  return new Date().toISOString()
}

function latestInteractionDate(interactions: Interaction[]): string | undefined {
  if (interactions.length === 0) return undefined
  return interactions.map((i) => i.date).sort().at(-1)
}

export class SupabaseContactRepository implements ContactRepository {
  async getAll(): Promise<Contact[]> {
    const { data, error } = await supabase.from('contacts').select('*')
    if (error) throw error
    return data.map(rowToContact)
  }

  async getById(id: string): Promise<Contact | undefined> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? rowToContact(data) : undefined
  }

  async create(draft: ContactDraft): Promise<Contact> {
    const userId = await getCurrentUserId()
    const timestamp = now()
    const interactions = draft.interactions ?? []
    const latest = latestInteractionDate(interactions)
    const contact: Contact = {
      ...draft,
      interactions,
      id: createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastContactDate:
        latest && (!draft.lastContactDate || latest > draft.lastContactDate)
          ? latest
          : draft.lastContactDate,
    }
    const { error } = await supabase
      .from('contacts')
      .insert(contactToRow(userId, contact))
    if (error) throw error
    return contact
  }

  async update(id: string, patch: ContactPatch): Promise<Contact> {
    const userId = await getCurrentUserId()
    const existing = await this.getById(id)
    if (!existing) throw new Error(`Contact ${id} not found`)
    const updated: Contact = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
    }
    const { error } = await supabase
      .from('contacts')
      .update(contactToRow(userId, updated))
      .eq('id', id)
    if (error) throw error
    return updated
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
  }

  async findDuplicates(
    firstName: string,
    lastName: string,
    company?: string,
    excludeId?: string,
  ): Promise<Contact[]> {
    const fn = firstName.trim().toLowerCase()
    const ln = lastName.trim().toLowerCase()
    const co = company?.trim().toLowerCase() ?? ''
    if (!fn && !ln) return []
    const all = await this.getAll()
    return all.filter((c) => {
      if (c.id === excludeId) return false
      const sameName =
        c.firstName.trim().toLowerCase() === fn &&
        c.lastName.trim().toLowerCase() === ln
      if (!sameName) return false
      if (co && c.company) return c.company.trim().toLowerCase() === co
      return true
    })
  }

  async addInteraction(
    contactId: string,
    interaction: Omit<Interaction, 'id' | 'createdAt'>,
  ): Promise<Contact> {
    const existing = await this.getById(contactId)
    if (!existing) throw new Error(`Contact ${contactId} not found`)
    const entry: Interaction = { ...interaction, id: createId(), createdAt: now() }
    const interactions = [...existing.interactions, entry]
    const latest = latestInteractionDate(interactions)
    return this.update(contactId, {
      interactions,
      lastContactDate:
        latest && (!existing.lastContactDate || latest > existing.lastContactDate)
          ? latest
          : existing.lastContactDate,
    })
  }

  async updateInteraction(
    contactId: string,
    interactionId: string,
    patch: Partial<Omit<Interaction, 'id' | 'createdAt'>>,
  ): Promise<Contact> {
    const existing = await this.getById(contactId)
    if (!existing) throw new Error(`Contact ${contactId} not found`)
    const interactions = existing.interactions.map((i) =>
      i.id === interactionId ? { ...i, ...patch, id: i.id } : i,
    )
    const latest = latestInteractionDate(interactions)
    return this.update(contactId, {
      interactions,
      lastContactDate: latest ?? existing.lastContactDate,
    })
  }

  async removeInteraction(contactId: string, interactionId: string): Promise<Contact> {
    const existing = await this.getById(contactId)
    if (!existing) throw new Error(`Contact ${contactId} not found`)
    const interactions = existing.interactions.filter((i) => i.id !== interactionId)
    return this.update(contactId, {
      interactions,
      lastContactDate: latestInteractionDate(interactions),
    })
  }

  async replaceAll(contacts: Contact[]): Promise<void> {
    const userId = await getCurrentUserId()
    await this.clear()
    if (contacts.length === 0) return
    const { error } = await supabase
      .from('contacts')
      .insert(contacts.map((c) => contactToRow(userId, c)))
    if (error) throw error
  }

  async clear(): Promise<void> {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('contacts').delete().eq('user_id', userId)
    if (error) throw error
  }
}
