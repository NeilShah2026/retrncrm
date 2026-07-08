import { SupabaseContactRepository } from './supabaseContactRepository'
import { SupabaseTagRepository } from './supabaseTagRepository'
import { SupabaseOpportunityRepository } from './supabaseOpportunityRepository'
import { SupabaseTemplateRepository } from './supabaseTemplateRepository'
import type {
  ContactRepository,
  OpportunityRepository,
  TagRepository,
  TemplateRepository,
} from './types'

/**
 * The single swap point for persistence. Everything in the app imports the
 * repositories from here — Supabase/Postgres now, scoped per-user via Row
 * Level Security (see supabase/migrations/0001_init.sql). Swapping backends
 * again later means implementing these same interfaces and reassigning the
 * instances below — no UI changes required.
 */
export const contactRepo: ContactRepository = new SupabaseContactRepository()
export const tagRepo: TagRepository = new SupabaseTagRepository()
export const opportunityRepo: OpportunityRepository =
  new SupabaseOpportunityRepository()
export const templateRepo: TemplateRepository = new SupabaseTemplateRepository()

export * from './types'
