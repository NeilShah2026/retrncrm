import { FREE_CONTACT_LIMIT } from './plans'

/**
 * Thrown when a free account tries to go past FREE_CONTACT_LIMIT contacts.
 *
 * The database is what actually refuses (a trigger on `contacts`, so the
 * Chrome extension and every other path are held to it too); the contact
 * repository turns that refusal into this error and announces it, and the
 * app answers the announcement with the upgrade prompt. Call sites only need
 * to stay quiet about it — see `isContactLimitError`.
 */
export class ContactLimitError extends Error {
  constructor() {
    super(`The free plan holds ${FREE_CONTACT_LIMIT} contacts. Upgrade for unlimited.`)
    this.name = 'ContactLimitError'
  }
}

export function isContactLimitError(err: unknown): err is ContactLimitError {
  return err instanceof ContactLimitError
}

/** The database's refusal, as PostgREST reports it. */
export function isContactLimitDbError(err: unknown): boolean {
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.includes('FREE_CONTACT_LIMIT')
}

const listeners = new Set<() => void>()

/** Run `fn` whenever the limit is hit. Returns an unsubscribe. */
export function onContactLimit(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Announce the limit (opens the upgrade prompt) and return the error to throw. */
export function contactLimitReached(): ContactLimitError {
  listeners.forEach((fn) => fn())
  return new ContactLimitError()
}
