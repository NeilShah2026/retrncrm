import { getCurrentUserId, supabase } from '@/lib/supabase'
import {
  followUpToRow,
  keyDateToRow,
  rowToFollowUp,
  rowToKeyDate,
} from './supabaseMappers'
import { createId } from '@/lib/utils'
import type { FollowUp, KeyDate } from '@/types'
import type {
  FollowUpDraft,
  FollowUpPatch,
  FollowUpRepository,
  KeyDateDraft,
  KeyDatePatch,
  KeyDateRepository,
} from './types'

/*
 * Follow-ups and key dates hang off a contact by a real foreign key, so
 * deleting a contact (or clearing all contacts) removes them in the database
 * without either repository needing a clear() of its own.
 */

function now(): string {
  return new Date().toISOString()
}

export class SupabaseFollowUpRepository implements FollowUpRepository {
  async getAll(): Promise<FollowUp[]> {
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .order('due_date', { ascending: true })
    if (error) throw error
    return data.map(rowToFollowUp)
  }

  async create(draft: FollowUpDraft): Promise<FollowUp> {
    const userId = await getCurrentUserId()
    const timestamp = now()
    const item: FollowUp = { ...draft, id: createId(), createdAt: timestamp, updatedAt: timestamp }
    const { error } = await supabase.from('follow_ups').insert(followUpToRow(userId, item))
    if (error) throw error
    return item
  }

  async update(id: string, patch: FollowUpPatch): Promise<FollowUp> {
    const userId = await getCurrentUserId()
    const { data: row, error: fetchError } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    // Spread keeps an explicit `completedAt: undefined` in the patch, which is
    // how "mark as not done" clears the column.
    const merged: FollowUp = { ...rowToFollowUp(row), ...patch, id, updatedAt: now() }
    const { error } = await supabase
      .from('follow_ups')
      .update(followUpToRow(userId, merged))
      .eq('id', id)
    if (error) throw error
    return merged
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('follow_ups').delete().eq('id', id)
    if (error) throw error
  }

  async insertAll(items: FollowUp[]): Promise<void> {
    if (items.length === 0) return
    const userId = await getCurrentUserId()
    const { error } = await supabase
      .from('follow_ups')
      .upsert(items.map((f) => followUpToRow(userId, f)))
    if (error) throw error
  }
}

export class SupabaseKeyDateRepository implements KeyDateRepository {
  async getAll(): Promise<KeyDate[]> {
    const { data, error } = await supabase.from('key_dates').select('*')
    if (error) throw error
    return data.map(rowToKeyDate)
  }

  async create(draft: KeyDateDraft): Promise<KeyDate> {
    const userId = await getCurrentUserId()
    const timestamp = now()
    const item: KeyDate = { ...draft, id: createId(), createdAt: timestamp, updatedAt: timestamp }
    const { error } = await supabase.from('key_dates').insert(keyDateToRow(userId, item))
    if (error) throw error
    return item
  }

  async update(id: string, patch: KeyDatePatch): Promise<KeyDate> {
    const userId = await getCurrentUserId()
    const { data: row, error: fetchError } = await supabase
      .from('key_dates')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    const merged: KeyDate = { ...rowToKeyDate(row), ...patch, id, updatedAt: now() }
    const { error } = await supabase
      .from('key_dates')
      .update(keyDateToRow(userId, merged))
      .eq('id', id)
    if (error) throw error
    return merged
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('key_dates').delete().eq('id', id)
    if (error) throw error
  }

  async insertAll(items: KeyDate[]): Promise<void> {
    if (items.length === 0) return
    const userId = await getCurrentUserId()
    for (let i = 0; i < items.length; i += 200) {
      const { error } = await supabase
        .from('key_dates')
        .upsert(items.slice(i, i + 200).map((k) => keyDateToRow(userId, k)))
      if (error) throw error
    }
  }
}
