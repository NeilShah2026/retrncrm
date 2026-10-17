import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/common/PageHeader'
import { BackBarButton } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useContacts, useTags } from '@/hooks/useData'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useUI } from '@/context/ui-context'
import { isAiAvailable } from '@/lib/ai/client'
import { isContactLimitError } from '@/lib/billing/contactLimit'
import { FREE_CONTACT_LIMIT } from '@/lib/billing/plans'
import { FIELDS, FIELD_BY_KEY, IGNORE, type ColumnTarget } from '@/lib/sheetImport/fields'
import {
  columnCount,
  hasNameColumn,
  matchByRules,
  matchColumns,
  type ColumnMapping,
} from '@/lib/sheetImport/mapping'
import { readSpreadsheet, SheetReadError, SHEET_ACCEPT, MAX_ROWS, type ParsedSheet } from '@/lib/sheetImport/read'
import {
  commitRows,
  deriveRows,
  normalize,
  rowStatuses,
  visibleFields,
  type CommitResult,
  type ImportRow,
  type RowField,
  type RowStatus,
  type RowValues,
} from '@/lib/sheetImport/rows'
import { downloadTemplate } from '@/lib/sheetImport/template'
import { successFeedback } from '@/lib/haptics'
import { track } from '@/lib/analytics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/**
 * Import contacts from a spreadsheet: choose a file, check every row, import.
 *
 * The review step is the point. Nobody's spreadsheet matches anyone else's,
 * so the page shows exactly what will be saved — which column became which
 * field, every person as a row, who is already in Retrn — and lets any of it
 * be changed before a single contact is written. Nothing leaves the device
 * until Import is pressed, except, when AI features are allowed, the first
 * few rows the column matcher looks at.
 */

type Stage =
  | { kind: 'upload' }
  | { kind: 'reading'; step: 'file' | 'columns' }
  | { kind: 'review' }
  | { kind: 'saving' }
  | { kind: 'done'; result: CommitResult; tag?: string }

type Filter = 'all' | 'ready' | 'attention' | 'existing'

/** Rows rendered per "Show more". */
const PAGE = 100

function batchTagName(): string {
  return `Imported ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

export function ImportSpreadsheetPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const contacts = useContacts()
  const tags = useTags()
  const { isPro } = useEntitlement()
  const { openUpgrade } = useUI()

  const [stage, setStage] = React.useState<Stage>({ kind: 'upload' })
  const [fileName, setFileName] = React.useState('')
  const [sheets, setSheets] = React.useState<ParsedSheet[]>([])
  const [sheetIndex, setSheetIndex] = React.useState(0)
  const [mapping, setMapping] = React.useState<ColumnMapping | null>(null)
  /** Edits on top of what the mapping produced, keyed by sheet row. */
  const [edits, setEdits] = React.useState<Record<number, RowValues>>({})
  /** Chosen rows, by sheet row. */
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [filter, setFilter] = React.useState<Filter>('all')
  const [shown, setShown] = React.useState(PAGE)
  const [useBatchTag, setUseBatchTag] = React.useState(true)
  const [batchTag, setBatchTag] = React.useState(batchTagName)
  const [dragging, setDragging] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const sheet = sheets[sheetIndex]
  const rawRows = React.useMemo(() => sheet?.rows.slice(0, MAX_ROWS + 20) ?? [], [sheet])

  const derived = React.useMemo(
    () => (mapping ? deriveRows(rawRows, mapping).slice(0, MAX_ROWS) : []),
    [rawRows, mapping],
  )
  const rows: ImportRow[] = React.useMemo(
    () =>
      derived.map((r) => (edits[r.sheetRow] ? { ...r, values: { ...r.values, ...edits[r.sheetRow] } } : r)),
    [derived, edits],
  )
  const statuses = React.useMemo(() => rowStatuses(rows, contacts ?? []), [rows, contacts])
  const fields = React.useMemo(() => (mapping ? visibleFields(mapping) : []), [mapping])

  /** The default selection: everyone ready to go, nobody already in Retrn. */
  const selectDefaults = React.useCallback((list: ImportRow[], st: RowStatus[]) => {
    setSelected(new Set(list.filter((_, i) => st[i].kind === 'ready').map((r) => r.sheetRow)))
  }, [])

  // A new mapping (or sheet) re-derives the rows, so the selection starts
  // over — and so does arriving at contacts that were still loading, or
  // people already in Retrn would start out selected.
  const lastMapping = React.useRef<ColumnMapping | null>(null)
  const contactsLoaded = contacts !== undefined
  const selectedWithContacts = React.useRef(false)
  React.useEffect(() => {
    if (!mapping) return
    const fresh = lastMapping.current !== mapping
    const catchUp = contactsLoaded && !selectedWithContacts.current
    if (!fresh && !catchUp) return
    lastMapping.current = mapping
    selectedWithContacts.current = contactsLoaded
    selectDefaults(rows, statuses)
    if (fresh) setShown(PAGE)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new mapping or first contacts
  }, [mapping, contactsLoaded])

  // --- Reading -------------------------------------------------------------

  async function openFile(file: File) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFileName(file.name)
    setStage({ kind: 'reading', step: 'file' })
    track('sheet_import_started', { type: file.name.split('.').pop()?.toLowerCase() ?? 'unknown' })
    try {
      const parsed = await readSpreadsheet(file)
      if (controller.signal.aborted) return
      // The sheet with the most recognisable columns, not the longest — the
      // template's "How to use" tab has more rows than its Contacts tab.
      const best = parsed
        .map((s, i) => {
          const m = matchByRules(s.rows)
          return { i, score: m.columns.filter((c) => c !== IGNORE).length * 10000 + s.rows.length }
        })
        .sort((a, b) => b.score - a.score)[0].i
      setSheets(parsed)
      await chooseSheet(parsed, best, controller.signal)
    } catch (err) {
      if (controller.signal.aborted) return
      setStage({ kind: 'upload' })
      if (err instanceof SheetReadError) toast.error(err.message)
      else {
        console.error(err)
        toast.error('That file couldn’t be read. Save it as .xlsx or .csv and try again.')
      }
    }
  }

  async function chooseSheet(list: ParsedSheet[], index: number, signal?: AbortSignal) {
    setSheetIndex(index)
    setEdits({})
    setStage({ kind: 'reading', step: 'columns' })
    const next = await matchColumns(list[index].rows, { useAi: isAiAvailable(), signal })
    if (signal?.aborted) return
    setMapping(next)
    setStage({ kind: 'review' })
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void openFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void openFile(file)
  }

  function startOver() {
    abortRef.current?.abort()
    setStage({ kind: 'upload' })
    setSheets([])
    setMapping(null)
    setEdits({})
    setSelected(new Set())
    setFilter('all')
  }

  // --- Review edits --------------------------------------------------------

  function setColumn(col: number, target: ColumnTarget) {
    if (!mapping) return
    const columns = mapping.columns.map((c, i) => {
      if (i === col) return target
      // A single-value field moves rather than duplicates.
      if (target !== IGNORE && c === target && !FIELD_BY_KEY[target].multiple) return IGNORE
      return c
    })
    setEdits({})
    setMapping({ ...mapping, columns })
  }

  function setHeaderRow(headerRow: number) {
    if (!mapping) return
    setEdits({})
    setMapping({ ...mapping, headerRow })
  }

  function editCell(sheetRow: number, field: RowField, value: string) {
    setEdits((all) => ({ ...all, [sheetRow]: { ...all[sheetRow], [field]: value } }))
    // Giving a nameless row a name makes it importable: pick it up.
    if (field === 'firstName' && value.trim()) {
      const index = rows.findIndex((r) => r.sheetRow === sheetRow)
      if (index >= 0 && statuses[index].kind === 'needs-name') {
        setSelected((s) => new Set(s).add(sheetRow))
      }
    }
  }

  function tidyCell(sheetRow: number, field: RowField, value: string) {
    const clean = normalize({ [field]: value })[field] ?? value
    if (clean !== value) editCell(sheetRow, field, clean)
  }

  function toggle(sheetRow: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(sheetRow)) next.delete(sheetRow)
      else next.add(sheetRow)
      return next
    })
  }

  // --- Counts --------------------------------------------------------------

  const indexed = rows.map((row, i) => ({ row, status: statuses[i] }))
  const importable = indexed.filter(
    ({ row, status }) => selected.has(row.sheetRow) && status.kind !== 'needs-name',
  )
  const counts = {
    all: rows.length,
    ready: indexed.filter((x) => x.status.kind === 'ready').length,
    attention: indexed.filter(
      (x) => x.status.kind === 'needs-name' || (x.status.kind === 'ready' && x.status.warnings.length > 0),
    ).length,
    existing: indexed.filter((x) => x.status.kind === 'existing' || x.status.kind === 'repeat').length,
  }
  const visible = indexed.filter(({ status }) => {
    if (filter === 'ready') return status.kind === 'ready'
    if (filter === 'attention')
      return status.kind === 'needs-name' || (status.kind === 'ready' && status.warnings.length > 0)
    if (filter === 'existing') return status.kind === 'existing' || status.kind === 'repeat'
    return true
  })

  const room = isPro ? Infinity : Math.max(FREE_CONTACT_LIMIT - (contacts?.length ?? 0), 0)
  const overLimit = importable.length > room
  const toImport = overLimit ? importable.slice(0, room) : importable

  const allVisibleSelectable = visible.filter((x) => x.status.kind !== 'needs-name')
  const allVisibleChosen =
    allVisibleSelectable.length > 0 && allVisibleSelectable.every((x) => selected.has(x.row.sheetRow))

  function toggleAllVisible() {
    setSelected((s) => {
      const next = new Set(s)
      for (const { row } of allVisibleSelectable) {
        if (allVisibleChosen) next.delete(row.sheetRow)
        else next.add(row.sheetRow)
      }
      return next
    })
  }

  // --- Saving --------------------------------------------------------------

  async function save() {
    if (toImport.length === 0 || !tags) return
    setStage({ kind: 'saving' })
    const tag = useBatchTag && batchTag.trim() ? batchTag.trim() : undefined
    try {
      const result = await commitRows(
        toImport.map((x) => x.row),
        { knownTags: tags, batchTag: tag },
      )
      successFeedback()
      track('sheet_import_completed', {
        count: result.added,
        matchedBy: mapping?.matchedBy ?? 'rules',
        rows: rows.length,
      })
      setStage({ kind: 'done', result, tag })
    } catch (err) {
      setStage({ kind: 'review' })
      if (isContactLimitError(err)) return
      console.error(err)
      toast.error('The import didn’t finish. Nothing was added — try again.')
    }
  }

  // --- Render --------------------------------------------------------------

  const title = stage.kind === 'review' || stage.kind === 'saving' ? 'Review import' : 'Import from Excel'

  return (
    <PageShell
      width="wide"
      scrollBody
      mobile={{ title, largeTitle: false, leading: <BackBarButton label="Contacts" /> }}
      header={
        <PageHeader
          title={title}
          description={
            stage.kind === 'review' || stage.kind === 'saving'
              ? `${fileName}${sheets.length > 1 ? ` · ${sheet?.name}` : ''}`
              : 'Bring in the people you already keep in a spreadsheet.'
          }
        >
          <Button variant="ghost" onClick={() => navigate(ROUTES.contacts)}>
            <ArrowLeft />
            Contacts
          </Button>
        </PageHeader>
      }
    >
      <input ref={fileRef} type="file" accept={SHEET_ACCEPT} className="hidden" onChange={onPick} />

      {stage.kind === 'upload' && (
        <UploadStep
          dragging={dragging}
          onChoose={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        />
      )}

      {stage.kind === 'reading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium">
            {stage.step === 'file' ? `Reading ${fileName}…` : 'Matching your columns to Retrn…'}
          </p>
          <Button variant="ghost" size="sm" onClick={startOver}>
            Cancel
          </Button>
        </div>
      )}

      {(stage.kind === 'review' || stage.kind === 'saving') && mapping && (
        <div className={cn('space-y-5', isMobile ? 'px-4 pb-40 pt-2' : 'pb-32')}>
          <MappingPanel
            rows={rawRows}
            mapping={mapping}
            sheets={sheets}
            sheetIndex={sheetIndex}
            onSheet={(i) => void chooseSheet(sheets, i)}
            onColumn={setColumn}
            onHeaderRow={setHeaderRow}
          />

          {!hasNameColumn(mapping) ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                No column is set as a name yet. Choose <strong>First Name</strong> or{' '}
                <strong>Full Name</strong> for the column that holds names, above.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No people found below the header row.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['all', 'All'],
                    ['ready', 'Ready'],
                    ['attention', 'Needs a look'],
                    ['existing', 'Already in Retrn'],
                  ] as [Filter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilter(key)
                      setShown(PAGE)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      filter === key
                        ? 'border-foreground bg-foreground text-background'
                        : 'text-text-secondary hover:border-border-strong',
                    )}
                  >
                    {label} <span className="tnum opacity-70">{counts[key]}</span>
                  </button>
                ))}
                {rows.length >= MAX_ROWS && (
                  <span className="text-xs text-muted-foreground">
                    Showing the first {MAX_ROWS.toLocaleString()} rows — import the rest as a second file.
                  </span>
                )}
              </div>

              <ReviewTable
                rows={visible.slice(0, shown)}
                fields={fields}
                selected={selected}
                allChosen={allVisibleChosen}
                onToggleAll={toggleAllVisible}
                onToggle={toggle}
                onEdit={editCell}
                onTidy={tidyCell}
              />
              {visible.length > shown && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                    Show {Math.min(PAGE, visible.length - shown)} more
                  </Button>
                </div>
              )}
            </>
          )}

          <ImportBar
            isMobile={isMobile}
            count={toImport.length}
            selectedCount={importable.length}
            room={room}
            overLimit={overLimit}
            saving={stage.kind === 'saving'}
            disabled={!hasNameColumn(mapping) || tags === undefined}
            useBatchTag={useBatchTag}
            batchTag={batchTag}
            onBatchTag={setBatchTag}
            onUseBatchTag={setUseBatchTag}
            onCancel={startOver}
            onUpgrade={() => openUpgrade()}
            onImport={() => void save()}
          />
        </div>
      )}

      {stage.kind === 'done' && (
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.8} />
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
            {stage.result.added} {stage.result.added === 1 ? 'person' : 'people'} imported
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {[
              stage.result.birthdays > 0 &&
                `${stage.result.birthdays} ${stage.result.birthdays === 1 ? 'birthday' : 'birthdays'} added as key dates`,
              stage.tag && `everyone tagged “${stage.tag}”`,
            ]
              .filter(Boolean)
              .join(', ') || 'They’re in your contacts now.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate(ROUTES.contacts)}>
              <Users />
              View contacts
            </Button>
            <Button variant="outline" onClick={startOver}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ---------------------------------------------------------------------------

function UploadStep({
  dragging,
  onChoose,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  dragging: boolean
  onChoose: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-0">
      <button
        type="button"
        onClick={onChoose}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
          dragging ? 'border-brand bg-brand/[0.05]' : 'hover:border-border-strong hover:bg-accent/30',
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Upload className="h-5 w-5" />
        </span>
        <span className="text-base font-semibold">Choose a spreadsheet</span>
        <span className="text-sm text-muted-foreground">
          Excel (.xlsx) or CSV — from Excel, Google Sheets, Numbers or LinkedIn’s export.
        </span>
      </button>

      <div className="flex items-start gap-3 rounded-lg border px-4 py-3.5 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-text-secondary">
          <span className="font-medium text-foreground">Any layout works.</span> Retrn works out which
          column is which, then shows you every row to check before anything is saved.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="text-sm">
            <p className="font-medium">Starting from scratch?</p>
            <p className="text-muted-foreground">
              Download the Retrn template, fill it in, and upload it here.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => void downloadTemplate('import_page')}>
          <Download />
          Download template
        </Button>
      </div>
    </div>
  )
}

function columnLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function MappingPanel({
  rows,
  mapping,
  sheets,
  sheetIndex,
  onSheet,
  onColumn,
  onHeaderRow,
}: {
  rows: string[][]
  mapping: ColumnMapping
  sheets: ParsedSheet[]
  sheetIndex: number
  onSheet: (index: number) => void
  onColumn: (col: number, target: ColumnTarget) => void
  onHeaderRow: (row: number) => void
}) {
  const width = columnCount(rows)
  const headers = mapping.headerRow >= 0 ? rows[mapping.headerRow] ?? [] : []
  const samples = rows.slice(mapping.headerRow + 1, mapping.headerRow + 4)

  return (
    <section className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Columns</h2>
          <p className="text-xs text-muted-foreground">
            {mapping.matchedBy === 'ai'
              ? 'Matched by AI from your headers and first few rows. Change any that look wrong.'
              : 'Matched by their names. Change any that look wrong.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheets.length > 1 && (
            <Select value={String(sheetIndex)} onValueChange={(v) => onSheet(Number(v))}>
              <SelectTrigger className="h-8 w-44 text-xs" aria-label="Sheet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s, i) => (
                  <SelectItem key={s.name + i} value={String(i)}>
                    Sheet: {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={String(mapping.headerRow)} onValueChange={(v) => onHeaderRow(Number(v))}>
            <SelectTrigger className="h-8 w-48 text-xs" aria-label="Header row">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-1">No header row</SelectItem>
              {rows.slice(0, 10).map((_, i) => (
                <SelectItem key={i} value={String(i)}>
                  Headers in row {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="scroll-native flex gap-2.5 overflow-x-auto p-3">
        {Array.from({ length: width }, (_, col) => {
          const target = mapping.columns[col] ?? IGNORE
          const values = samples.map((r) => r[col]).filter(Boolean)
          return (
            <div
              key={col}
              className={cn(
                'flex w-52 shrink-0 flex-col gap-2 rounded-md border p-3',
                target === IGNORE && 'bg-bg-sunken/60',
              )}
            >
              <p className="truncate text-xs font-medium" title={headers[col]}>
                <span className="mr-1.5 text-muted-foreground">{columnLetter(col)}</span>
                {headers[col] || <span className="text-muted-foreground">No header</span>}
              </p>
              <div className="h-10 space-y-0.5 overflow-hidden text-xs text-muted-foreground">
                {values.length ? (
                  values.slice(0, 2).map((v, i) => (
                    <p key={i} className="truncate">
                      {v}
                    </p>
                  ))
                ) : (
                  <p className="italic">Empty</p>
                )}
              </div>
              <Select value={target} onValueChange={(v) => onColumn(col, v as ColumnTarget)}>
                <SelectTrigger
                  className={cn('h-8 text-xs', target !== IGNORE && 'border-brand/50')}
                  aria-label={`Column ${columnLetter(col)} becomes`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={IGNORE}>Don’t import</SelectItem>
                  <SelectSeparator />
                  {FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: RowStatus }) {
  switch (status.kind) {
    case 'needs-name':
      return <Badge variant="warning">Needs a name</Badge>
    case 'existing':
      return <Badge variant="secondary">Already in Retrn</Badge>
    case 'repeat':
      return <Badge variant="secondary">Same as row {status.ofSheetRow}</Badge>
    case 'ready':
      return status.warnings.length ? (
        <Badge variant="warning" title={status.warnings.join('\n')}>
          Check {status.warnings.length === 1 ? 'a value' : `${status.warnings.length} values`}
        </Badge>
      ) : (
        <Badge variant="success">Ready</Badge>
      )
  }
}

/** Column widths in the review table, by field. */
const CELL_WIDTH: Partial<Record<RowField, string>> = {
  email: 'w-56',
  notes: 'w-72',
  linkedinUrl: 'w-60',
  jobTitle: 'w-48',
  company: 'w-44',
  website: 'w-52',
}

function ReviewTable({
  rows,
  fields,
  selected,
  allChosen,
  onToggleAll,
  onToggle,
  onEdit,
  onTidy,
}: {
  rows: { row: ImportRow; status: RowStatus }[]
  fields: RowField[]
  selected: Set<number>
  allChosen: boolean
  onToggleAll: () => void
  onToggle: (sheetRow: number) => void
  onEdit: (sheetRow: number, field: RowField, value: string) => void
  onTidy: (sheetRow: number, field: RowField, value: string) => void
}) {
  return (
    <div className="scroll-native overflow-x-auto rounded-lg border">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-bg-sunken/60 text-left text-xs text-muted-foreground">
            <th className="sticky left-0 z-10 w-10 bg-bg-sunken px-3 py-2">
              <Checkbox
                checked={allChosen}
                onCheckedChange={onToggleAll}
                aria-label="Select all shown"
              />
            </th>
            <th className="w-12 px-2 py-2 font-medium">Row</th>
            <th className="w-36 px-2 py-2 font-medium">Status</th>
            {fields.map((f) => (
              <th key={f} className={cn('px-2 py-2 font-medium', CELL_WIDTH[f] ?? 'w-36')}>
                {FIELD_BY_KEY[f].label}
                {f === 'firstName' && <span className="text-danger"> *</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, status }) => {
            const blocked = status.kind === 'needs-name'
            const chosen = selected.has(row.sheetRow) && !blocked
            const dim = status.kind === 'existing' || status.kind === 'repeat'
            return (
              <tr
                key={row.sheetRow}
                className={cn(
                  'border-b last:border-b-0',
                  chosen ? 'bg-background' : 'bg-bg-sunken/30',
                  dim && !chosen && 'text-muted-foreground',
                )}
              >
                <td className={cn('sticky left-0 z-10 px-3 py-1.5', chosen ? 'bg-background' : 'bg-bg-sunken')}>
                  <Checkbox
                    checked={chosen}
                    disabled={blocked}
                    onCheckedChange={() => onToggle(row.sheetRow)}
                    aria-label={`Import row ${row.sheetRow}`}
                  />
                </td>
                <td className="tnum px-2 py-1.5 text-xs text-muted-foreground">{row.sheetRow}</td>
                <td className="px-2 py-1.5">
                  <StatusBadge status={status} />
                </td>
                {fields.map((f) => (
                  <td key={f} className="px-1 py-1">
                    <input
                      value={row.values[f] ?? ''}
                      onChange={(e) => onEdit(row.sheetRow, f, e.target.value)}
                      onBlur={(e) => onTidy(row.sheetRow, f, e.target.value)}
                      placeholder={f === 'firstName' ? 'Add a name' : ''}
                      aria-label={`${FIELD_BY_KEY[f].label}, row ${row.sheetRow}`}
                      aria-invalid={f === 'firstName' && blocked ? true : undefined}
                      className={cn(
                        'h-8 w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-sm',
                        'hover:border-border focus:border-brand focus:bg-background focus:outline-none focus:ring-2 focus:ring-brand/20',
                        'aria-[invalid=true]:border-warning/60 aria-[invalid=true]:bg-warning-soft',
                        CELL_WIDTH[f] ?? 'w-36',
                      )}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ImportBar({
  isMobile,
  count,
  selectedCount,
  room,
  overLimit,
  saving,
  disabled,
  useBatchTag,
  batchTag,
  onBatchTag,
  onUseBatchTag,
  onCancel,
  onUpgrade,
  onImport,
}: {
  isMobile: boolean
  count: number
  selectedCount: number
  room: number
  overLimit: boolean
  saving: boolean
  disabled: boolean
  useBatchTag: boolean
  batchTag: string
  onBatchTag: (v: string) => void
  onUseBatchTag: (v: boolean) => void
  onCancel: () => void
  onUpgrade: () => void
  onImport: () => void
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 border-t bg-background/95 backdrop-blur',
        // Above the phone's tab bar; flush with the content column on a laptop.
        // (the sidebar is `w-56`, AppLayout).
        isMobile ? 'bottom-[var(--tab-bar-inset)]' : 'bottom-0 md:left-56',
      )}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={useBatchTag} onCheckedChange={(v) => onUseBatchTag(v === true)} />
            Tag everyone
          </label>
          <Input
            value={batchTag}
            onChange={(e) => onBatchTag(e.target.value)}
            disabled={!useBatchTag}
            maxLength={40}
            aria-label="Tag for this import"
            className="h-8 w-48"
          />
          {overLimit && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              {room > 0
                ? `The free plan has room for ${room} more — the first ${room} of ${selectedCount} selected will be imported.`
                : `The free plan holds ${FREE_CONTACT_LIMIT} contacts.`}
              <button type="button" onClick={onUpgrade} className="font-medium text-brand hover:underline">
                Upgrade for unlimited
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          {room === 0 && overLimit ? (
            <Button onClick={onUpgrade}>Upgrade to import</Button>
          ) : (
            <Button onClick={onImport} disabled={disabled || saving || count === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              {saving
                ? 'Importing…'
                : count === 0
                  ? 'Select people to import'
                  : `Import ${count} ${count === 1 ? 'person' : 'people'}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
