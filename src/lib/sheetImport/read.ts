/**
 * Reading a spreadsheet file into rows of strings, entirely on the device.
 *
 * Nothing here uploads anything: the file is opened in the browser, and only
 * what the person later confirms on the review screen is saved. The xlsx
 * reader is loaded on demand, so the app doesn't carry it for everyone who
 * never imports a sheet.
 */

export interface ParsedSheet {
  name: string
  /** Every non-empty row, every cell as trimmed text. */
  rows: string[][]
}

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheetReadError'
  }
}

/** What the file picker should offer. */
export const SHEET_ACCEPT =
  '.xlsx,.csv,.tsv,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Big enough for any personal network; small enough not to hang a phone. */
const MAX_BYTES = 10 * 1024 * 1024
export const MAX_ROWS = 5000

export async function readSpreadsheet(file: File): Promise<ParsedSheet[]> {
  if (file.size > MAX_BYTES) {
    throw new SheetReadError('That file is over 10 MB. Split it into smaller sheets and import each one.')
  }
  const name = file.name.toLowerCase()

  if (name.endsWith('.xls') || name.endsWith('.numbers')) {
    throw new SheetReadError(
      'That format can’t be read. In Excel or Numbers, choose File → Save As (or Export) → .xlsx or .csv, then try again.',
    )
  }

  let sheets: ParsedSheet[]
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') || file.type.startsWith('text/')) {
    const text = await file.text()
    sheets = [{ name: file.name.replace(/\.[^.]+$/, ''), rows: parseDelimited(text) }]
  } else {
    sheets = await readXlsx(file)
  }

  sheets = sheets
    .map((s) => ({ ...s, rows: s.rows.filter((r) => r.some((c) => c !== '')) }))
    .filter((s) => s.rows.length > 0)
  if (sheets.length === 0) throw new SheetReadError('That file doesn’t have any rows in it.')
  return sheets
}

async function readXlsx(file: File): Promise<ParsedSheet[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  let raw: Awaited<ReturnType<typeof readXlsxFile>>
  try {
    raw = await readXlsxFile(file)
  } catch (err) {
    console.error('[import] could not read xlsx', err)
    throw new SheetReadError(
      'That file couldn’t be opened as a spreadsheet. Save it as .xlsx or .csv and try again.',
    )
  }
  return raw.map((sheet) => ({
    name: sheet.sheet,
    rows: sheet.data.map((row) => row.map(cellText)),
  }))
}

function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) {
    // Dates come back as UTC midnight; read them as the calendar date.
    return Number.isNaN(cell.getTime()) ? '' : cell.toISOString().slice(0, 10)
  }
  if (typeof cell === 'number') {
    // 2027.0 → "2027", and no scientific notation on phone numbers.
    return Number.isInteger(cell) ? cell.toFixed(0) : String(cell)
  }
  if (typeof cell === 'boolean') return cell ? 'Yes' : 'No'
  return String(cell).replace(/\s+/g, ' ').trim()
}

/**
 * RFC 4180-ish CSV: quoted fields, doubled quotes, newlines inside quotes.
 * Comma, semicolon (European Excel) or tab, whichever the first line uses most.
 */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.slice(0, clean.search(/\r?\n|$/))
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const)
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0][0]

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows
}
