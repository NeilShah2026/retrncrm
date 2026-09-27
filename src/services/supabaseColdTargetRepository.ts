import { getCurrentUserId, supabase } from '@/lib/supabase'
import { coldTargetToRow, rowToColdTarget } from './supabaseMappers'
import { createId } from '@/lib/utils'
import { coldTargetLimitReached, isColdTargetLimitDbError } from '@/lib/billing/coldTargetLimit'
import type { ColdTarget } from '@/types'
import type { ColdTargetDraft, ColdTargetPatch, ColdTargetRepository } from './types'

function now(): string {
  return new Date().toISOString()
}

export class SupabaseColdTargetRepository implements ColdTargetRepository {
  async getAll(): Promise<ColdTarget[]> {
    const { data, error } = await supabase
      .from('cold_targets')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(rowToColdTarget)
  }

  async create(draft: ColdTargetDraft): Promise<ColdTarget> {
    const userId = await getCurrentUserId()
    const timestamp = now()
    const item: ColdTarget = { ...draft, id: createId(), createdAt: timestamp, updatedAt: timestamp }
    const { error } = await supabase.from('cold_targets').insert(coldTargetToRow(userId, item))
    if (error) {
      if (isColdTargetLimitDbError(error)) throw coldTargetLimitReached()
      throw error
    }
    return item
  }

  async update(id: string, patch: ColdTargetPatch): Promise<ColdTarget> {
    const userId = await getCurrentUserId()
    const { data: row, error: fetchError } = await supabase
      .from('cold_targets')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    // Spread keeps an explicit `nextFollowUp: undefined` in the patch, which
    // is how "no more follow-ups" clears the column.
    const merged: ColdTarget = { ...rowToColdTarget(row), ...patch, id, updatedAt: now() }
    const { error } = await supabase
      .from('cold_targets')
      .update(coldTargetToRow(userId, merged))
      .eq('id', id)
    if (error) throw error
    return merged
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('cold_targets').delete().eq('id', id)
    if (error) throw error
  }
}
