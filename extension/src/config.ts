/**
 * Supabase project config. These are the SAME public values your web app
 * ships in its client bundle — the anon key is a publishable key protected by
 * row-level security, so it's safe to include here.
 *
 * If you rotate keys or point at a different project, update these two lines.
 */
export const SUPABASE_URL = 'https://plkpfojzqsgfqpfeeasf.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsa3Bmb2p6cXNnZnFwZmVlYXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NjM3OTAsImV4cCI6MjA5OTAzOTc5MH0.HMWz0qOdQtMIeQgVeqCGEppi5udyQxX9N7GGh6EoZBo'

/** The web app. Links into a contact and "Open Retrn" go here. */
export const APP_ORIGIN = 'https://www.retrncrm.com'

/**
 * Where a signed-in Retrn tab might be open. Only used to *suggest* the email
 * to sign in with — the extension never borrows that tab's session.
 *
 * ⚠️ Every origin here must also be in `host_permissions` in
 * public/manifest.json, or the extension can't read that tab.
 */
export const RETRN_APP_URLS = ['https://www.retrncrm.com', 'https://retrncrm.com', 'http://localhost:5173']

export const contactUrl = (id: string) => `${APP_ORIGIN}/app/contacts/${id}`
