/**
 * Hand-written to match supabase/migrations/0001_init.sql, in the same shape
 * `supabase gen types typescript` produces. Once the project is connected via
 * the CLI, regenerate the canonical version with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name: string
          photo: string | null
          company: string | null
          job_title: string | null
          industry: string | null
          linkedin_url: string | null
          email: string | null
          phone: string | null
          twitter: string | null
          other_links: Json
          connection_type: string | null
          school: string | null
          grad_year: string | null
          major: string | null
          source: string | null
          introduced_by_id: string | null
          talking_points: string | null
          how_we_met: string | null
          where_we_met: string | null
          date_met: string | null
          tag_ids: string[]
          relationship_strength: number
          last_contact_date: string | null
          contact_frequency_goal: string
          notes: string | null
          interactions: Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['contacts']['Row']> & {
          id: string
          user_id: string
          first_name: string
        }
        Update: Partial<Database['public']['Tables']['contacts']['Row']>
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['tags']['Row']> & {
          id: string
          user_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['tags']['Row']>
        Relationships: []
      }
      opportunities: {
        Row: {
          id: string
          user_id: string
          company: string
          role: string
          type: string
          stage: string
          outcome: string | null
          location: string | null
          link: string | null
          deadline: string | null
          applied_date: string | null
          notes: string | null
          contact_ids: string[]
          order: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['opportunities']['Row']> & {
          id: string
          user_id: string
          company: string
          role: string
        }
        Update: Partial<Database['public']['Tables']['opportunities']['Row']>
        Relationships: []
      }
      templates: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          subject: string | null
          body: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['templates']['Row']> & {
          id: string
          user_id: string
          name: string
          body: string
        }
        Update: Partial<Database['public']['Tables']['templates']['Row']>
        Relationships: []
      }
      events: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          location: string | null
          starts_at: string
          ends_at: string
          all_day: boolean
          contact_ids: string[]
          logged: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['events']['Row']> & {
          user_id: string
          title: string
          starts_at: string
          ends_at: string
        }
        Update: Partial<Database['public']['Tables']['events']['Row']>
        Relationships: []
      }
      calendar_tokens: {
        Row: {
          token: string
          user_id: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['calendar_tokens']['Row']> & {
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['calendar_tokens']['Row']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
