/**
 * Best-effort parser for text copied from a LinkedIn profile page. There is no
 * way to fetch from LinkedIn client-side (no public API, CORS, ToS), so instead
 * the user copies the visible profile text and we extract what we can. It's
 * heuristic by nature — every field is pre-filled for the user to confirm/edit.
 */

export interface ParsedLinkedIn {
  firstName?: string
  lastName?: string
  jobTitle?: string
  company?: string
  linkedinUrl?: string
  location?: string
}

const NOISE = new RegExp(
  [
    '^contact info$',
    '^message$',
    '^connect$',
    '^follow$',
    '^following$',
    '^more$',
    '^pending$',
    '^see (more|contact info)',
    '^open to',
    '^\\d+(st|nd|rd|th)$',
    '^\\d[\\d,]* (followers|connections)',
    '^connections?$',
    '^followers?$',
    '^·$',
    '^activity$',
    '^about$',
    '^experience$',
    '^education$',
  ].join('|'),
  'i',
)

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function looksLikeName(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false
  if (/[|@]|\bat\b|·|\d/.test(line)) return false
  const words = line.split(' ')
  return words.length >= 2 && words.length <= 5 && /^[\p{L}'’.\- ]+$/u.test(line)
}

/** Split a headline like "Product Manager at Fidelity" into title + company. */
function splitHeadline(headline: string): { jobTitle?: string; company?: string } {
  const atMatch = headline.split(/\s+(?:at|@)\s+/i)
  if (atMatch.length >= 2) {
    return {
      jobTitle: atMatch[0].trim(),
      // Company may itself be followed by more "| ..." — take up to a pipe.
      company: atMatch[1].split(/\s*[|•·]\s*/)[0].trim(),
    }
  }
  const pipeParts = headline.split(/\s*[|•·]\s*/).map((p) => p.trim())
  if (pipeParts.length >= 2) {
    return { jobTitle: pipeParts[0], company: pipeParts[1] }
  }
  return { jobTitle: headline.trim() }
}

export function parseLinkedIn(input: string): ParsedLinkedIn {
  const result: ParsedLinkedIn = {}
  const text = input.trim()
  if (!text) return result

  // A LinkedIn profile URL anywhere in the pasted text.
  const urlMatch = text.match(
    /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s)]+/i,
  )
  if (urlMatch) result.linkedinUrl = urlMatch[0].replace(/[.,]$/, '')

  // If the paste is basically just a URL, derive a name from the vanity slug.
  const bareUrl = text.match(
    /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?\s]+)/i,
  )
  if (bareUrl && text.length < 120) {
    result.linkedinUrl = urlMatch?.[0] ?? text
    const slug = decodeURIComponent(bareUrl[1]).replace(/-[0-9a-f]{6,}$/i, '')
    const parts = slug.split('-').filter(Boolean)
    if (parts.length >= 2) {
      result.firstName = cap(parts[0])
      result.lastName = parts.slice(1).map(cap).join(' ')
    } else if (parts.length === 1) {
      result.firstName = cap(parts[0])
    }
    return result
  }

  const lines = text
    .split('\n')
    .map(cleanLine)
    .filter((l) => l && !NOISE.test(l) && !/^https?:\/\//i.test(l))

  // Deduplicate consecutive repeats (LinkedIn often repeats the name).
  const deduped: string[] = []
  for (const l of lines) if (deduped[deduped.length - 1] !== l) deduped.push(l)

  const nameIdx = deduped.findIndex(looksLikeName)
  if (nameIdx !== -1) {
    const parts = deduped[nameIdx].split(' ')
    result.firstName = parts[0]
    result.lastName = parts.slice(1).join(' ')

    // Headline: first following line that isn't another copy of the name.
    const headline = deduped
      .slice(nameIdx + 1)
      .find((l) => l !== deduped[nameIdx] && l.length > 2)
    if (headline) {
      const { jobTitle, company } = splitHeadline(headline)
      result.jobTitle = jobTitle
      result.company = company
    }

    // Location: a later line mentioning "Area", a comma region, etc.
    const loc = deduped
      .slice(nameIdx + 1)
      .find(
        (l) =>
          /area|, [A-Z]{2}\b|, [A-Za-z]+$|United States|Greater/.test(l) &&
          !/\bat\b|[|@]/.test(l) &&
          l.length < 60,
      )
    if (loc) result.location = loc
  }

  return result
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
