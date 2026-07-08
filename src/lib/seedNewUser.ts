import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { buildStarterContent } from './starterContent'
import { contactRepo, opportunityRepo, tagRepo, templateRepo } from '@/services'

// Single-flight guard: auth state can fire multiple SIGNED_IN events in quick
// succession (initial getSession + onAuthStateChange both resolving), so
// share one in-flight promise per user rather than racing duplicate inserts.
const inFlight = new Map<string, Promise<void>>()

/**
 * Seed a brand-new account with the starter example contact + templates,
 * exactly once. Uses a flag in the user's own auth metadata rather than a
 * database row, so there's nothing to set up beyond the four content tables.
 */
export function ensureUserSeeded(user: User): Promise<void> {
  if (user.user_metadata?.seeded) return Promise.resolve()
  const existing = inFlight.get(user.id)
  if (existing) return existing

  const task = runSeed(user)
  inFlight.set(user.id, task)
  return task
}

async function runSeed(user: User): Promise<void> {
  try {
    // Additive inserts only — never clear/replace here, so this is safe to
    // run defensively even if the "seeded" guard were ever bypassed.
    const content = buildStarterContent()
    for (const tag of content.tags) {
      await tagRepo.create({ name: tag.name, color: tag.color })
    }
    for (const contact of content.contacts) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = contact
      await contactRepo.create(draft)
    }
    for (const template of content.templates) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = template
      await templateRepo.create(draft)
    }
    void opportunityRepo // starter content has none today; kept for symmetry
    await supabase.auth.updateUser({ data: { seeded: true } })
  } catch (err) {
    console.error('Failed to seed starter content', err)
  } finally {
    inFlight.delete(user.id)
  }
}
