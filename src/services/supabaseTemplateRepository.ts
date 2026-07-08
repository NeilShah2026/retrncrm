import { getCurrentUserId, supabase } from '@/lib/supabase'
import { rowToTemplate, templateToRow } from './supabaseMappers'
import { createId } from '@/lib/utils'
import type { OutreachTemplate } from '@/types'
import type { TemplateDraft, TemplatePatch, TemplateRepository } from './types'

function now(): string {
  return new Date().toISOString()
}

export class SupabaseTemplateRepository implements TemplateRepository {
  async getAll(): Promise<OutreachTemplate[]> {
    const { data, error } = await supabase.from('templates').select('*')
    if (error) throw error
    return data.map(rowToTemplate)
  }

  async create(draft: TemplateDraft): Promise<OutreachTemplate> {
    const userId = await getCurrentUserId()
    const timestamp = now()
    const template: OutreachTemplate = {
      ...draft,
      id: createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const { error } = await supabase
      .from('templates')
      .insert(templateToRow(userId, template))
    if (error) throw error
    return template
  }

  async update(id: string, patch: TemplatePatch): Promise<OutreachTemplate> {
    const userId = await getCurrentUserId()
    const { data: existingRow, error: fetchError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) throw fetchError
    const updated: OutreachTemplate = {
      ...rowToTemplate(existingRow),
      ...patch,
      id,
      updatedAt: now(),
    }
    const { error } = await supabase
      .from('templates')
      .update(templateToRow(userId, updated))
      .eq('id', id)
    if (error) throw error
    return updated
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) throw error
  }

  async replaceAll(items: OutreachTemplate[]): Promise<void> {
    const userId = await getCurrentUserId()
    await this.clear()
    if (items.length === 0) return
    const { error } = await supabase
      .from('templates')
      .insert(items.map((t) => templateToRow(userId, t)))
    if (error) throw error
  }

  async clear(): Promise<void> {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('templates').delete().eq('user_id', userId)
    if (error) throw error
  }
}
