import { getCurrentUserId, supabase } from '@/lib/supabase'
import { rowToTag, tagToRow } from './supabaseMappers'
import { createId } from '@/lib/utils'
import type { Tag } from '@/types'
import type { TagDraft, TagRepository } from './types'

export class SupabaseTagRepository implements TagRepository {
  async getAll(): Promise<Tag[]> {
    const { data, error } = await supabase.from('tags').select('*').order('name')
    if (error) throw error
    return data.map(rowToTag)
  }

  async create(draft: TagDraft): Promise<Tag> {
    const userId = await getCurrentUserId()
    const tag: Tag = { ...draft, id: createId(), createdAt: new Date().toISOString() }
    const { error } = await supabase.from('tags').insert(tagToRow(userId, tag))
    if (error) throw error
    return tag
  }

  async update(id: string, patch: Partial<Omit<Tag, 'id' | 'createdAt'>>): Promise<Tag> {
    const userId = await getCurrentUserId()
    const { data: existingRow, error: fetchError } = await supabase
      .from('tags')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    const updated: Tag = { ...rowToTag(existingRow), ...patch, id }
    const { error } = await supabase
      .from('tags')
      .update(tagToRow(userId, updated))
      .eq('id', id)
    if (error) throw error
    return updated
  }

  async remove(id: string): Promise<void> {
    const userId = await getCurrentUserId()
    // Detach the tag from every contact that referenced it (contacts embed
    // tag_ids directly rather than using a join table).
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, tag_ids')
      .contains('tag_ids', [id])
    if (fetchError) throw fetchError
    for (const c of contacts ?? []) {
      const { error } = await supabase
        .from('contacts')
        .update({
          tag_ids: (c.tag_ids ?? []).filter((t) => t !== id),
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id)
      if (error) throw error
    }
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
  }

  async replaceAll(tags: Tag[]): Promise<void> {
    const userId = await getCurrentUserId()
    await this.clear()
    if (tags.length === 0) return
    const { error } = await supabase
      .from('tags')
      .insert(tags.map((t) => tagToRow(userId, t)))
    if (error) throw error
  }

  async clear(): Promise<void> {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('tags').delete().eq('user_id', userId)
    if (error) throw error
  }
}
