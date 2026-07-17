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

/**
 * Where the Retrn web app runs. Used by "Connect with Retrn" (SSO): the
 * extension reads your existing signed-in session from a tab on any of these
 * origins, so you don't have to log in twice. The first entry is the one we
 * open if no signed-in tab is found (your production site).
 *
 * ⚠️ Every origin listed here must ALSO be in `host_permissions` in
 * public/manifest.json, or the extension can't read that tab.
 */
export const RETRN_APP_URLS = [
  'https://retrncrm.com',
  'https://www.retrncrm.com',
  'http://localhost:5173',
]
