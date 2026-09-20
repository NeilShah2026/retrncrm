import { postApi } from '@/lib/apiFetch'
import { supabase } from '@/lib/supabase'
import type { ShareProfile } from '@/lib/shareProfile'

/**
 * The published side of a QR card — everything that needs `/api/card`.
 *
 * A Retrn card has always been able to travel entirely inside its own link
 * (`/add#<token>`), and still can: that path needs no server, no row and no
 * network beyond loading the page. Publishing adds what a self-contained
 * link cannot do — a short URL you can read off a name badge, a count of who
 * scanned it, and a way for the person who scanned to send their details
 * back.
 *
 * Every call here fails soft. If migration 0009 hasn't run, or the endpoint
 * is unreachable, the caller gets `null` and falls back to the long link:
 * a QR code that still works is worth more than an error message.
 */

/** A card as its owner sees it. */
export interface MyCard {
  slug: string
  scanCount: number
  saveCount: number
}

/** Someone's details, sent back after they scanned a card. */
export interface Handoff {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  headline?: string
  school?: string
  note?: string
  whereWeMet?: string
  /** ISO date (yyyy-mm-dd). */
  metOn?: string
  createdAt: string
}

/** What someone sends back through a card they scanned. */
export interface HandoffDraft {
  name: string
  email?: string
  phone?: string
  company?: string
  headline?: string
  school?: string
  note?: string
  whereWeMet?: string
  metOn?: string
}

/** The short link for a published card. */
export function cardUrl(slug: string, origin: string): string {
  return `${origin}/c/${slug}`
}

/**
 * The slug in a scanned string, if it is one of our short links.
 * `https://www.retrncrm.com/c/neil-shah` -> `neil-shah`.
 *
 * Deliberately not host-checked: the same code is scanned from a preview
 * deployment, from localhost and from either production domain, and a link
 * that only resolves on the host it was printed from is a bad short link.
 */
export function slugFromLink(raw: string): string | null {
  const text = raw.trim()
  const match = /^(?:https?:\/\/[^/]+)?\/c\/([a-z0-9-]{1,60})\/?$/i.exec(text)
  return match ? match[1].toLowerCase() : null
}

async function accessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

async function callCard<T>(body: Record<string, unknown>, token?: string): Promise<T | null> {
  try {
    const res = await postApi('/api/card', body, { token, timeoutMs: 15_000 })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Publish or refresh the signed-in user's card, returning its slug.
 *
 * Called whenever the QR screen is opened with a profile that has a name, so
 * an edited headline reaches the card without anyone having to think about
 * "publishing". The slug itself never changes once assigned — a printed link
 * has to keep working.
 */
export async function publishCard(profile: ShareProfile): Promise<string | null> {
  if (!profile.name.trim()) return null
  const token = await accessToken()
  if (!token) return null
  const result = await callCard<{ slug: string }>({ action: 'publish', profile }, token)
  return result?.slug ?? null
}

/**
 * The profile behind a scanned short link.
 *
 * `count` is false on anything that isn't a real arrival — a re-render, the
 * owner previewing their own card — so the number on the QR screen keeps
 * meaning "people who scanned this".
 */
export async function resolveCard(
  slug: string,
  { count = false }: { count?: boolean } = {},
): Promise<ShareProfile | null> {
  const result = await callCard<{ profile: ShareProfile }>({ action: 'resolve', slug, count })
  return result?.profile ?? null
}

/** Tell a card someone saved it. Best-effort; nothing depends on the answer. */
export function reportSaved(slug: string): void {
  void callCard({ action: 'saved', slug })
}

/** Send your own details back to the person whose card you scanned. */
export async function sendHandoff(slug: string, draft: HandoffDraft): Promise<boolean> {
  const result = await callCard<{ ok: boolean }>({ action: 'handoff', slug, ...draft })
  return result?.ok === true
}

/** The signed-in user's card and anything waiting to be accepted. */
export async function fetchMyCard(): Promise<{ card: MyCard | null; handoffs: Handoff[] } | null> {
  const token = await accessToken()
  if (!token) return null
  return callCard<{ card: MyCard | null; handoffs: Handoff[] }>({ action: 'mine' }, token)
}

/** Mark handoffs as dealt with, once they have been made into contacts. */
export async function claimHandoffs(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const token = await accessToken()
  if (!token) return
  await callCard({ action: 'claim', ids }, token)
}
