import { track } from '@/lib/analytics'
import { FREE_COLD_TARGET_LIMIT } from './plans'

/**
 * Thrown when a free account tries to open an eleventh cold email target.
 *
 * As with contacts, the database is what refuses (a trigger on
 * `cold_targets`, so the extension is held to it too); the repository turns
 * the refusal into this, and the page answers it with the upgrade prompt.
 */
export class ColdTargetLimitError extends Error {
  constructor() {
    super(`The free plan tracks ${FREE_COLD_TARGET_LIMIT} cold emails at a time. Upgrade for unlimited.`)
    this.name = 'ColdTargetLimitError'
  }
}

export function isColdTargetLimitError(err: unknown): err is ColdTargetLimitError {
  return err instanceof ColdTargetLimitError
}

/** The database's refusal, as PostgREST reports it. */
export function isColdTargetLimitDbError(err: unknown): boolean {
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.includes('FREE_COLD_TARGET_LIMIT')
}

export function coldTargetLimitReached(): ColdTargetLimitError {
  track('cold_target_limit_reached', { limit: FREE_COLD_TARGET_LIMIT })
  return new ColdTargetLimitError()
}
