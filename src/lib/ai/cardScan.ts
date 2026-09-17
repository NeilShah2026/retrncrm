import { askClaudeJson, AiRequestError } from './client'
import { createId } from '@/lib/utils'
import type { Contact, OtherLink } from '@/types'

/**
 * A photo of a business card, read into contact fields.
 *
 * The photo is shrunk on the device first (a phone camera's 12MP original is
 * several megabytes; the model needs a card-sized image, not that), sent once
 * to the model, and discarded. It is never stored — the card isn't the
 * contact's photo, and keeping it would be keeping data nobody asked for.
 */

/** Long edge, in pixels. Plenty for card text; small enough to send quickly. */
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85
/** Anything bigger than this isn't a card photo we can sensibly shrink in a WebView. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

export class CardScanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CardScanError'
  }
}

/** Downscale and re-encode as JPEG. Browsers apply the photo's EXIF rotation when drawing. */
export async function prepareCardImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new CardScanError('That isn’t a photo.')
  }
  if (file.size > MAX_INPUT_BYTES) throw new CardScanError('That photo is too large.')

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new CardScanError('Couldn’t open that photo.'))
      el.src = url
    })
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new CardScanError('Couldn’t read that photo.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const SYSTEM = `You read business cards. You are given one photo, which should \
show a business card (possibly at an angle, possibly with other things in frame).

Reply with a single JSON object and nothing else:
{"isCard": true, "firstName": "", "lastName": "", "company": "", "jobTitle": "", \
"email": "", "phone": "", "website": "", "linkedinUrl": "", "twitter": "", "address": ""}

Rules:
- Omit any key the card doesn't show. Never guess or invent a value.
- Copy spellings exactly as printed. Keep the person's name capitalised as a name \
even if the card prints it in all caps.
- If there are several phone numbers, prefer mobile, then direct, then main.
- "company" is the organisation; a tagline or department is not the company.
- If the photo isn't a business card or no person's name is readable, reply \
{"isCard": false}.`

interface RawCard {
  isCard?: unknown
  firstName?: unknown
  lastName?: unknown
  company?: unknown
  jobTitle?: unknown
  email?: unknown
  phone?: unknown
  website?: unknown
  linkedinUrl?: unknown
  twitter?: unknown
  address?: unknown
}

function text(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') return undefined
  const s = value.replace(/\s+/g, ' ').trim()
  if (!s || s.length > max || /^(null|none|n\/a|unknown)$/i.test(s)) return undefined
  return s
}

function url(value: unknown): string | undefined {
  const s = text(value, 200)
  if (!s || /\s/.test(s)) return undefined
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

/** "SARAH CHEN" → "Sarah Chen"; "McDonald" stays as printed. */
function nameCase(s: string | undefined): string | undefined {
  if (!s) return s
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()) : s
}

export type CardFields = Pick<
  Contact,
  'firstName' | 'lastName' | 'company' | 'jobTitle' | 'email' | 'phone' | 'linkedinUrl' | 'twitter' | 'otherLinks'
> & { notes?: string }

/** Photo in, contact fields out. Throws `CardScanError` with a message worth showing. */
export async function scanBusinessCard(file: File, signal?: AbortSignal): Promise<CardFields> {
  const data = await prepareCardImage(file)

  let raw: RawCard
  try {
    raw = await askClaudeJson<RawCard>({
      system: SYSTEM,
      maxTokens: 400,
      signal,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
            { type: 'text', text: 'Read this business card.' },
          ],
        },
      ],
    })
  } catch (err) {
    if (err instanceof AiRequestError) throw new CardScanError(err.message)
    throw err
  }

  const firstName = nameCase(text(raw.firstName, 60))
  if (raw.isCard === false || !firstName) {
    throw new CardScanError('Couldn’t find a name on that card. Try a closer, flatter photo.')
  }

  const otherLinks: OtherLink[] = []
  const website = url(raw.website)
  if (website) otherLinks.push({ id: createId(), label: 'Website', url: website })

  const email = text(raw.email, 120)
  const address = text(raw.address, 200)
  return {
    firstName,
    lastName: nameCase(text(raw.lastName, 60)) ?? '',
    company: text(raw.company, 80),
    jobTitle: text(raw.jobTitle, 80),
    email: email && /^\S+@\S+\.\S+$/.test(email) ? email.toLowerCase() : undefined,
    phone: text(raw.phone, 40),
    linkedinUrl: url(raw.linkedinUrl),
    twitter: url(raw.twitter),
    otherLinks,
    notes: address ? `Address on card: ${address}` : undefined,
  }
}
