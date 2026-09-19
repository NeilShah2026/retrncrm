/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Comma-separated emails that see Settings' testing tools. Optional. */
  readonly VITE_ADMIN_EMAILS?: string
  /** PostHog project key. Analytics are off entirely without it. */
  readonly VITE_POSTHOG_KEY?: string
  /** PostHog host; defaults to https://us.i.posthog.com. */
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
