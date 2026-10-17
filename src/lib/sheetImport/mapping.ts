import { askClaudeJson } from '@/lib/ai/client'
import { FIELDS, FIELD_BY_KEY, IGNORE, normalizeHeader, type ColumnTarget, type ImportField } from './fields'

/**
 * Working out which column is which.
 *
 * Everyone's sheet is different — "Name" in one column or "First"/"Last" in
 * two, a title row above the headers, no headers at all, notes split across
 * three columns. Two matchers handle that:
 *
 *  - **Rules**, always: header spellings (fields.ts), then what the values
 *    look like (an @ is an email, linkedin.com is a LinkedIn URL).
 *  - **The AI**, when the account allows it: given the field list and the
 *    first few rows only — never the whole sheet — it returns the same shape
 *    the rules do. The mapping is then applied to every row on the device.
 *
 * Either way the person sees the result on the review screen and can change
 * any column before anything is saved.
 */

export interface ColumnMapping {
  /** Index of the header row in the sheet, or -1 when the sheet has none. */
  headerRow: number
  /** One target per column, by column index. */
  columns: ColumnTarget[]
  matchedBy: 'ai' | 'rules'
}

/** Rows the AI is shown: the header (wherever it is) and a handful of people. */
const AI_SAMPLE_ROWS = 8
const AI_CELL_CHARS = 40
/** How far down to look for the header row. */
const HEADER_SCAN_ROWS = 10

export function columnCount(rows: string[][]): number {
  return rows.reduce((n, r) => Math.max(n, r.length), 0)
}

// --- Rules ---------------------------------------------------------------

const ALIASES: [string, ImportField][] = FIELDS.flatMap((f) =>
  f.aliases.map((a) => [normalizeHeader(a), f.key] as [string, ImportField]),
)

function fieldForHeader(header: string): ImportField | null {
  const h = normalizeHeader(header)
  if (!h) return null
  const exact = ALIASES.find(([alias]) => alias === h)
  if (exact) return exact[1]
  // "Work Email Address", "Company / Org": a longer header that contains a
  // distinctive alias. Short aliases ("x", "li", "met") only match exactly.
  const partial = ALIASES.filter(([alias]) => alias.length >= 4 && h.includes(alias)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0]
  return partial?.[1] ?? null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const looksLike = {
  email: (v: string) => EMAIL_RE.test(v),
  linkedin: (v: string) => /linkedin\.com\//i.test(v),
  phone: (v: string) => /^[+()\d][\d\s().-]{6,}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7,
  url: (v: string) => /^(https?:\/\/|www\.)/i.test(v),
  /** One to four capitalised words and nothing else: "Maya Patel", "Patel, Maya". */
  name: (v: string) => /^\p{Lu}[\p{L}'’.-]*(,?\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u.test(v),
}

function fieldForValues(values: string[]): ImportField | null {
  const filled = values.filter(Boolean)
  if (filled.length === 0) return null
  const share = (test: (v: string) => boolean) => filled.filter(test).length / filled.length
  if (share(looksLike.email) >= 0.6) return 'email'
  if (share(looksLike.linkedin) >= 0.6) return 'linkedinUrl'
  if (share(looksLike.phone) >= 0.6) return 'phone'
  if (share(looksLike.url) >= 0.6) return 'website'
  return null
}

function findHeaderRow(rows: string[][]): number {
  let best = -1
  let bestScore = 0
  rows.slice(0, HEADER_SCAN_ROWS).forEach((row, i) => {
    const score = row.filter((c) => fieldForHeader(c)).length
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  })
  if (best >= 0) return best
  // Nothing recognisable: treat the first row as headers unless it is plainly
  // a person (it has an email or a phone number in it).
  const first = rows[0] ?? []
  return first.some((c) => looksLike.email(c) || looksLike.phone(c)) ? -1 : 0
}

/** Single-value fields may be claimed once; later claims are dropped. */
function dedupe(columns: ColumnTarget[]): ColumnTarget[] {
  const taken = new Set<ImportField>()
  return columns.map((target) => {
    if (target === IGNORE) return target
    if (FIELD_BY_KEY[target].multiple) return target
    if (taken.has(target)) return IGNORE
    taken.add(target)
    return target
  })
}

export function matchByRules(rows: string[][]): ColumnMapping {
  const headerRow = findHeaderRow(rows)
  const width = columnCount(rows)
  const headers = headerRow >= 0 ? rows[headerRow] : []
  const body = rows.slice(headerRow + 1, headerRow + 31)

  const columnValues = (i: number) => body.map((r) => r[i] ?? '')
  const columns: ColumnTarget[] = Array.from({ length: width }, (_, i) => {
    const byHeader = headers[i] ? fieldForHeader(headers[i]) : null
    const byValues = fieldForValues(columnValues(i))
    // What's in the column beats a vague header: LinkedIn's own export calls
    // its profile column "URL".
    if (byValues === 'linkedinUrl' && (byHeader === null || byHeader === 'website')) return byValues
    return byHeader ?? byValues ?? IGNORE
  })

  // No header names a name column (or there are no headers): the first
  // unclaimed column that reads like people's names is one.
  if (!columns.some((c) => c === 'firstName' || c === 'fullName')) {
    const i = columns.findIndex((c, i) => {
      if (c !== IGNORE) return false
      const filled = columnValues(i).filter(Boolean)
      return filled.length > 0 && filled.filter(looksLike.name).length / filled.length >= 0.7
    })
    if (i >= 0) columns[i] = 'fullName'
  }

  // "First" + "Last" beat a "Name" column that would duplicate them.
  const fixed = columns.includes('firstName')
    ? columns.map((c) => (c === 'fullName' ? IGNORE : c))
    : columns
  return { headerRow, columns: dedupe(fixed), matchedBy: 'rules' }
}

// --- AI ------------------------------------------------------------------

const ALLOWED = new Set<string>([...FIELDS.map((f) => f.key), IGNORE])

interface RawAiMapping {
  headerRow?: unknown
  columns?: unknown
}

/**
 * Ask the model. Throws on any failure — including the account not allowing
 * AI features — and the caller keeps the rules-based mapping.
 */
export async function matchByAi(rows: string[][], signal?: AbortSignal): Promise<ColumnMapping> {
  const width = columnCount(rows)
  const sample = rows.slice(0, AI_SAMPLE_ROWS).map((row, r) => {
    const cells = Array.from({ length: width }, (_, i) =>
      (row[i] ?? '').slice(0, AI_CELL_CHARS).replace(/\|/g, '/'),
    )
    return `row ${r}: ${cells.join(' | ')}`
  })

  const fieldList = FIELDS.map((f) => `- ${f.key}: ${f.description}${f.multiple ? ' (several columns allowed)' : ''}`).join('\n')

  const raw = await askClaudeJson<RawAiMapping>({
    maxTokens: 400,
    signal,
    system: `You map the columns of a contacts spreadsheet onto a CRM's fields.

Fields:
${fieldList}
- ignore: a column that fits none of these (IDs, internal status codes, empty columns)

The sheet has ${width} columns. You see only its first rows, cells separated by " | ".
Decide which row (0-based) holds the column headers, or -1 if there is no header row and the first row is already a person. Rows above the header (titles, blank-ish rows) are skipped.
Map every column, in order, to exactly one field key. Use fullName when one column holds a whole name. Prefer notes over ignore for columns with useful free text about the person. Each field except tags and notes may be used at most once.

Reply with a single JSON object and nothing else:
{"headerRow": 0, "columns": ["firstName", "lastName", "email", "ignore"]}`,
    messages: [{ role: 'user', content: sample.join('\n') }],
  })

  const headerRow =
    typeof raw.headerRow === 'number' && raw.headerRow >= -1 && raw.headerRow < AI_SAMPLE_ROWS
      ? Math.floor(raw.headerRow)
      : 0
  const list = Array.isArray(raw.columns) ? raw.columns : []
  const columns: ColumnTarget[] = Array.from({ length: width }, (_, i) => {
    const v = typeof list[i] === 'string' ? (list[i] as string) : IGNORE
    return (ALLOWED.has(v) ? v : IGNORE) as ColumnTarget
  })

  const mapping = { headerRow, columns: dedupe(columns), matchedBy: 'ai' as const }
  if (!hasNameColumn(mapping)) throw new Error('AI mapping found no name column')
  return mapping
}

export function hasNameColumn(mapping: Pick<ColumnMapping, 'columns'>): boolean {
  return mapping.columns.some((c) => c === 'firstName' || c === 'fullName')
}

/** Rules first; the AI's answer replaces them when it succeeds. */
export async function matchColumns(
  rows: string[][],
  options: { useAi: boolean; signal?: AbortSignal },
): Promise<ColumnMapping> {
  const rules = matchByRules(rows)
  if (!options.useAi) return rules
  try {
    return await matchByAi(rows, options.signal)
  } catch (err) {
    if (options.signal?.aborted) throw err
    return rules
  }
}
