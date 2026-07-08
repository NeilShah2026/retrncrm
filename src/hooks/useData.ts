import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import {
  rowToContact,
  rowToOpportunity,
  rowToTag,
  rowToTemplate,
} from '@/services/supabaseMappers'
import type { Contact, Opportunity, OutreachTemplate, Tag } from '@/types'

type TableName = 'contacts' | 'tags' | 'opportunities' | 'templates'

/**
 * Reactive read for one table, scoped to the signed-in user. Fetches once on
 * mount/user-change, then re-fetches whenever Supabase Realtime reports any
 * insert/update/delete on that table for this user. Refetching the whole
 * list on any change (rather than patching state surgically) keeps this
 * simple — personal-CRM data is small enough that it's not a real cost.
 *
 * Mutations go through the repositories in `@/services`; components never
 * write to Supabase directly.
 */
function useRealtimeTable<T>(
  table: TableName,
  mapRow: (row: never) => T,
): T[] | undefined {
  const { user } = useAuth()
  const [data, setData] = React.useState<T[] | undefined>(undefined)

  React.useEffect(() => {
    if (!user) {
      setData(undefined)
      return
    }
    let active = true
    setData(undefined)

    async function load() {
      const { data: rows, error } = await supabase.from(table).select('*')
      if (!active) return
      if (error) {
        console.error(`Failed to load ${table}`, error)
        setData([])
        return
      }
      setData((rows as never[]).map(mapRow))
    }
    void load()

    // Topic must be unique per subscription attempt: Supabase's client
    // reuses any existing channel with the same topic name, and removal is
    // async — a fast remount (React StrictMode, quick navigation) can call
    // `.channel()` again before the old one finishes being removed, getting
    // back an already-subscribed channel and crashing on `.on()`.
    const channel = supabase
      .channel(`${table}-${user.id}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [user, table, mapRow])

  return data
}

export function useContacts(): Contact[] | undefined {
  return useRealtimeTable('contacts', rowToContact as (row: never) => Contact)
}

/** Derived from the live contacts list — undefined while loading, null if not found. */
export function useContact(id: string | undefined): Contact | undefined | null {
  const contacts = useContacts()
  if (contacts === undefined) return undefined
  if (!id) return null
  return contacts.find((c) => c.id === id) ?? null
}

export function useTags(): Tag[] | undefined {
  const tags = useRealtimeTable('tags', rowToTag as (row: never) => Tag)
  return React.useMemo(
    () => (tags ? [...tags].sort((a, b) => a.name.localeCompare(b.name)) : tags),
    [tags],
  )
}

/** Map of tagId → Tag for quick lookups when rendering contact rows. */
export function useTagMap(): Map<string, Tag> {
  const tags = useTags()
  const map = new Map<string, Tag>()
  for (const t of tags ?? []) map.set(t.id, t)
  return map
}

/** Map of contactId → Contact for lookups (intro graph, opportunity cards). */
export function useContactMap(): Map<string, Contact> {
  const contacts = useContacts()
  const map = new Map<string, Contact>()
  for (const c of contacts ?? []) map.set(c.id, c)
  return map
}

export function useOpportunities(): Opportunity[] | undefined {
  return useRealtimeTable(
    'opportunities',
    rowToOpportunity as (row: never) => Opportunity,
  )
}

export function useTemplates(): OutreachTemplate[] | undefined {
  return useRealtimeTable(
    'templates',
    rowToTemplate as (row: never) => OutreachTemplate,
  )
}
