import { getCurrentUserId, supabase } from '@/lib/supabase'
import { rowToEvent, eventToRow } from './supabaseMappers'
import { createId } from '@/lib/utils'
import type { CalendarEvent } from '@/types'
import type { EventDraft, EventPatch, EventRepository } from './types'

function now(): string {
  return new Date().toISOString()
}

export class SupabaseEventRepository implements EventRepository {
  async getAll(): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true })
    if (error) throw error
    return data.map(rowToEvent)
  }

  async create(draft: EventDraft): Promise<CalendarEvent> {
    const userId = await getCurrentUserId()
    const timestamp = now()
    const event: CalendarEvent = {
      ...draft,
      id: createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const { error } = await supabase.from('events').insert(eventToRow(userId, event))
    if (error) throw error
    return event
  }

  async update(id: string, patch: EventPatch): Promise<CalendarEvent> {
    const userId = await getCurrentUserId()
    const { data: existingRow, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    const merged: CalendarEvent = {
      ...rowToEvent(existingRow),
      ...patch,
      id,
      updatedAt: now(),
    }
    const { error } = await supabase
      .from('events')
      .update(eventToRow(userId, merged))
      .eq('id', id)
    if (error) throw error
    return merged
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw error
  }

  async replaceAll(items: CalendarEvent[]): Promise<void> {
    const userId = await getCurrentUserId()
    await this.clear()
    if (items.length === 0) return
    const { error } = await supabase
      .from('events')
      .insert(items.map((e) => eventToRow(userId, e)))
    if (error) throw error
  }

  async clear(): Promise<void> {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('events').delete().eq('user_id', userId)
    if (error) throw error
  }
}
