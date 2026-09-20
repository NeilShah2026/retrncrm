/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Comma-separated emails that see Settings' testing tools. Optional. */
  readonly VITE_ADMIN_EMAILS?: string
  /** PostHog public project key (phc_…). Analytics are off without it. */
  readonly VITE_POSTHOG_KEY?: string
  /** PostHog's other name for the same public key. Either will do. */
  readonly VITE_POSTHOG_PROJECT_TOKEN?: string
  /** PostHog host; defaults to https://us.i.posthog.com. */
  readonly VITE_POSTHOG_HOST?: string
  /** Dev only: '1' lets a headless browser's events through, for smoke tests. */
  readonly VITE_POSTHOG_ALLOW_BOTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
