/**
 * Builds the downloadable contacts template:
 * public/templates/Retrn-Contacts-Template.xlsx
 *
 *   npm run template
 *
 * The columns come from src/lib/sheetImport/fields.ts (Node strips the
 * types), so the template's headers are exactly the names the importer
 * recognises without any AI at all. Re-run it whenever that list changes and
 * commit the .xlsx — it's served as a static file, so the app never ships a
 * spreadsheet writer.
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { TEMPLATE_EXAMPLE_EMAIL, TEMPLATE_FIELDS } from '../src/lib/sheetImport/fields.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/templates/Retrn-Contacts-Template.xlsx')

// DESIGN.md's brand blue, hsl(217 80% 46%), and the neutrals around it.
const BRAND = 'FF175FD3'
const INK = 'FF1F2937'
const MUTED = 'FF6B7280'
const EXAMPLE_FILL = 'FFF3F6FC'
const HAIRLINE = 'FFD9DEE7'
const FONT = 'Calibri'

const wb = new ExcelJS.Workbook()
wb.creator = 'Retrn'
wb.title = 'Retrn contacts template'
wb.created = new Date('2026-10-17T00:00:00Z')

// --- Contacts sheet ------------------------------------------------------

const sheet = wb.addWorksheet('Contacts', {
  views: [{ state: 'frozen', ySplit: 1, xSplit: 1, activeCell: 'A3' }],
  properties: { defaultRowHeight: 20 },
})

sheet.columns = TEMPLATE_FIELDS.map((f) => ({
  header: f.key === 'firstName' ? `${f.label} *` : f.label,
  key: f.key,
  width: f.template.width,
}))

const header = sheet.getRow(1)
header.height = 28
header.eachCell((cell, col) => {
  const field = TEMPLATE_FIELDS[col - 1]
  cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  cell.border = { bottom: { style: 'medium', color: { argb: 'FF0F4AA8' } } }
  if (field.template.note) {
    cell.note = { texts: [{ text: field.template.note }], margins: { insetmode: 'auto' } }
  }
})

const example = sheet.addRow(
  Object.fromEntries(
    TEMPLATE_FIELDS.map((f) => [f.key, f.key === 'email' ? TEMPLATE_EXAMPLE_EMAIL : f.template.example]),
  ),
)
example.height = 22
example.eachCell({ includeEmpty: true }, (cell) => {
  cell.font = { name: FONT, size: 11, italic: true, color: { argb: MUTED } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXAMPLE_FILL } }
  cell.alignment = { vertical: 'middle', indent: 1 }
  cell.border = { bottom: { style: 'thin', color: { argb: HAIRLINE } } }
})
example.getCell(1).note = {
  texts: [{ text: 'An example. Type over it or leave it — Retrn skips this row when you import.' }],
}

// Room to type: plain rows with a hairline, text-formatted so phone numbers
// keep their leading zeros and "2027" doesn't turn into a date.
for (let r = 3; r <= 502; r++) {
  const row = sheet.getRow(r)
  for (let c = 1; c <= TEMPLATE_FIELDS.length; c++) {
    const cell = row.getCell(c)
    cell.numFmt = '@'
    cell.font = { name: FONT, size: 11, color: { argb: INK } }
    cell.alignment = { vertical: 'middle', indent: 1 }
    cell.border = { bottom: { style: 'hair', color: { argb: HAIRLINE } } }
  }
}

sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TEMPLATE_FIELDS.length } }

// --- How to use sheet ----------------------------------------------------

const help = wb.addWorksheet('How to use', { properties: { tabColor: { argb: BRAND } } })
help.columns = [
  { key: 'a', width: 4 },
  { key: 'b', width: 22 },
  { key: 'c', width: 52 },
  { key: 'd', width: 30 },
]

const title = help.getCell('B2')
title.value = 'Import your contacts into Retrn'
title.font = { name: FONT, size: 18, bold: true, color: { argb: INK } }
help.getRow(2).height = 30

const steps = [
  'Fill in the Contacts tab, one person per row. Only First Name is required.',
  'Save the file (keep it as .xlsx, or export as .csv).',
  'In Retrn, open Contacts → Import from Excel and choose this file.',
  'Check the preview, fix anything flagged, and import.',
]
steps.forEach((text, i) => {
  const row = help.getRow(4 + i)
  row.getCell(2).value = `${i + 1}.`
  row.getCell(2).alignment = { horizontal: 'right' }
  row.getCell(3).value = text
  row.getCell(2).font = { name: FONT, size: 11, bold: true, color: { argb: BRAND } }
  row.getCell(3).font = { name: FONT, size: 11, color: { argb: INK } }
  row.height = 20
})

const guideTop = 4 + steps.length + 2
const guideHeader = help.getRow(guideTop)
;['Column', 'What to put', 'Example'].forEach((text, i) => {
  const cell = guideHeader.getCell(i + 2)
  cell.value = text
  cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  cell.alignment = { vertical: 'middle', indent: 1 }
})
guideHeader.height = 24

TEMPLATE_FIELDS.forEach((f, i) => {
  const row = help.getRow(guideTop + 1 + i)
  row.getCell(2).value = f.key === 'firstName' ? `${f.label} (required)` : f.label
  row.getCell(3).value = f.template.note ? `${f.description}. ${f.template.note}` : f.description
  row.getCell(4).value = f.key === 'email' ? TEMPLATE_EXAMPLE_EMAIL : f.template.example
  row.getCell(2).font = { name: FONT, size: 11, bold: true, color: { argb: INK } }
  row.getCell(3).font = { name: FONT, size: 11, color: { argb: INK } }
  row.getCell(4).font = { name: FONT, size: 11, italic: true, color: { argb: MUTED } }
  for (let c = 2; c <= 4; c++) {
    const cell = row.getCell(c)
    cell.alignment = { vertical: 'top', wrapText: true, indent: 1 }
    cell.border = { bottom: { style: 'hair', color: { argb: HAIRLINE } } }
    if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXAMPLE_FILL } }
  }
})

const tipsTop = guideTop + TEMPLATE_FIELDS.length + 3
const tips = [
  'Already have your own spreadsheet? You don’t need this template — import it as it is. Retrn works out which column is which, and you can correct it before anything is saved.',
  'Extra columns are fine. Anything Retrn doesn’t recognise can go into Notes or be skipped.',
  'People already in Retrn (same email, phone or name) are flagged and skipped unless you choose to import them.',
]
help.getCell(`B${tipsTop}`).value = 'Good to know'
help.getCell(`B${tipsTop}`).font = { name: FONT, size: 13, bold: true, color: { argb: INK } }
tips.forEach((text, i) => {
  const r = tipsTop + 1 + i
  help.mergeCells(`B${r}:D${r}`)
  const cell = help.getCell(`B${r}`)
  cell.value = `•  ${text}`
  cell.font = { name: FONT, size: 11, color: { argb: INK } }
  cell.alignment = { wrapText: true, vertical: 'top' }
  help.getRow(r).height = 32
})

mkdirSync(dirname(out), { recursive: true })
await wb.xlsx.writeFile(out)
console.log(`template: wrote ${out.replace(root, '.')}`)
