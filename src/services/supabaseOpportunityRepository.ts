import { getCurrentUserId, supabase } from '@/lib/supabase'
import { opportunityToRow, rowToOpportunity } from './supabaseMappers'
import { createId } from '@/lib/utils'
import type { Opportunity } from '@/types'
import type {
  OpportunityDraft,
  OpportunityPatch,
  OpportunityRepository,
} from './types'

function now(): string {
  return new Date().toISOString()
}

export class SupabaseOpportunityRepository implements OpportunityRepository {
  async getAll(): Promise<Opportunity[]> {
    const { data, error } = await supabase.from('opportunities').select('*')
    if (error) throw error
    return data.map(rowToOpportunity)
  }

  async getById(id: string): Promise<Opportunity | undefined> {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? rowToOpportunity(data) : undefined
  }

  async create(draft: OpportunityDraft): Promise<Opportunity> {
    const userId = await getCurrentUserId()
    let order = draft.order
    if (order === undefined) {
      const { count, error } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('stage', draft.stage)
      if (error) throw error
      order = count ?? 0
    }
    const timestamp = now()
    const opportunity: Opportunity = {
      ...draft,
      order,
      id: createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const { error } = await supabase
      .from('opportunities')
      .insert(opportunityToRow(userId, opportunity))
    if (error) throw error
    return opportunity
  }

  async update(id: string, patch: OpportunityPatch): Promise<Opportunity> {
    const userId = await getCurrentUserId()
    const existing = await this.getById(id)
    if (!existing) throw new Error(`Opportunity ${id} not found`)
    const updated: Opportunity = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
    }
    const { error } = await supabase
      .from('opportunities')
      .update(opportunityToRow(userId, updated))
      .eq('id', id)
    if (error) throw error
    return updated
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('opportunities').delete().eq('id', id)
    if (error) throw error
  }

  async replaceAll(items: Opportunity[]): Promise<void> {
    const userId = await getCurrentUserId()
    await this.clear()
    if (items.length === 0) return
    const { error } = await supabase
      .from('opportunities')
      .insert(items.map((o) => opportunityToRow(userId, o)))
    if (error) throw error
  }

  async clear(): Promise<void> {
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  }
}
