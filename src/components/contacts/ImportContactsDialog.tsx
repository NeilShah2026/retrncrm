import * as React from 'react'
import { toast } from 'sonner'
import { BookUser, Cake, FileUp, Loader2, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SheetBar,
  SheetBarButton,
} from '@/components/ui/dialog'
import { InsetCheckRow, InsetGroup, InsetInputRow, InsetRow } from '@/components/ui/inset-list'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useContacts } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  AddressBookError,
  canReadPhoneContacts,
  importCandidates,
  markExisting,
  parseVCards,
  readPhoneContacts,
  type ImportCandidate,
} from '@/lib/addressBook'
import { formatKeyDate } from '@/lib/keyDates'
import { selectionFeedback, successFeedback } from '@/lib/haptics'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Rows rendered at once. Search narrows a big address book to what's shown. */
const RENDER_LIMIT = 300

type Stage = 'intro' | 'loading' | 'pick' | 'saving'

/**
 * Bring people in from the phone's Contacts (iOS app) or a .vcf file (web).
 * Nobody is selected to start with: a personal CRM is the people who matter,
 * not the plumber and every dentist's office in the address book.
 */
export function ImportContactsDialog({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile()
  const contacts = useContacts() ?? []
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [stage, setStage] = React.useState<Stage>('intro')
  const [candidates, setCandidates] = React.useState<ImportCandidate[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setStage('intro')
    setCandidates([])
    setSelected(new Set())
    setQuery('')
    setError(null)
  }, [open])

  function load(list: ImportCandidate[]) {
    if (list.length === 0) {
      setError('No contacts found there.')
      setStage('intro')
      return
    }
    setCandidates(markExisting(list, contacts))
    setStage('pick')
  }

  async function fromPhone() {
    setError(null)
    setStage('loading')
    try {
      load(await readPhoneContacts())
    } catch (err) {
      setError(err instanceof AddressBookError ? err.message : 'Couldn’t read your contacts.')
      setStage('intro')
    }
  }

  function fromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setStage('loading')
    const reader = new FileReader()
    reader.onload = () => load(parseVCards(String(reader.result ?? '')))
    reader.onerror = () => {
      setError('Couldn’t read that file.')
      setStage('intro')
    }
    reader.readAsText(file)
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.company ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q),
    )
  }, [candidates, query])
  const selectable = filtered.filter((c) => !c.existingId)
  const allShownSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.key))

  function toggle(key: string) {
    selectionFeedback()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllShown() {
    selectionFeedback()
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of selectable) {
        if (allShownSelected) next.delete(c.key)
        else next.add(c.key)
      }
      return next
    })
  }

  async function save() {
    const chosen = candidates.filter((c) => selected.has(c.key) && !c.existingId)
    if (chosen.length === 0) return
    setStage('saving')
    try {
      const added = await importCandidates(chosen)
      const birthdays = chosen.filter((c) => c.birthday).length
      successFeedback()
      toast.success(
        `Imported ${added} ${added === 1 ? 'contact' : 'contacts'}${
          birthdays ? ` and ${birthdays} ${birthdays === 1 ? 'birthday' : 'birthdays'}` : ''
        }`,
      )
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Import failed. Nothing was added.')
      setStage('pick')
    }
  }

  const count = [...selected].filter((k) => candidates.some((c) => c.key === k && !c.existingId)).length
  const already = candidates.filter((c) => c.existingId).length
  const shown = filtered.slice(0, RENDER_LIMIT)
  const source = canReadPhoneContacts ? 'your iPhone' : 'a contacts file'

  const fileInput = (
    <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={fromFile} />
  )

  const describe = (c: ImportCandidate) =>
    [
      [c.jobTitle, c.company].filter(Boolean).join(' at '),
      c.email ?? c.phone,
      c.existingId ? 'Already in Retrn' : undefined,
    ]
      .filter(Boolean)
      .join(' · ')

  function renderPhone() {
    return (
      <DialogContent tall hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
        <DialogHeader>
          <SheetBar
            leading={<SheetBarButton close>Cancel</SheetBarButton>}
            title="Import Contacts"
            trailing={
              stage === 'pick' || stage === 'saving' ? (
                <SheetBarButton strong disabled={count === 0 || stage === 'saving'} onClick={() => void save()}>
                  {stage === 'saving' ? 'Adding…' : count ? `Add ${count}` : 'Add'}
                </SheetBarButton>
              ) : undefined
            }
          />
        </DialogHeader>

        <div className="space-y-6 px-4 pb-8 pt-1">
          {stage === 'intro' || stage === 'loading' ? (
            <>
              <IntroCopy source={source} />
              <InsetGroup footer={error ?? undefined}>
                <InsetRow
                  leading={
                    stage === 'loading' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-brand" />
                    ) : canReadPhoneContacts ? (
                      <BookUser className="h-5 w-5 text-brand" />
                    ) : (
                      <FileUp className="h-5 w-5 text-brand" />
                    )
                  }
                  title={
                    <span className="text-brand">
                      {canReadPhoneContacts ? 'Choose from iPhone Contacts' : 'Choose a .vcf File'}
                    </span>
                  }
                  chevron={false}
                  disabled={stage === 'loading'}
                  last
                  onClick={() => (canReadPhoneContacts ? void fromPhone() : fileRef.current?.click())}
                />
              </InsetGroup>
            </>
          ) : (
            <>
              <InsetGroup>
                <InsetInputRow value={query} onChange={setQuery} placeholder="Search" autoCapitalize="words" last />
              </InsetGroup>
              <InsetGroup
                title={`${candidates.length} contacts${already ? ` · ${already} already in Retrn` : ''}`}
                footer={filtered.length > RENDER_LIMIT ? `Showing ${RENDER_LIMIT} of ${filtered.length}. Search to find someone.` : undefined}
              >
                {selectable.length > 0 && (
                  <InsetRow
                    title={<span className="text-brand">{allShownSelected ? 'Deselect All' : `Select All${query ? ' Shown' : ''}`}</span>}
                    chevron={false}
                    last={shown.length === 0}
                    onClick={toggleAllShown}
                  />
                )}
                {shown.map((c, i) =>
                  c.existingId ? (
                    <InsetRow
                      key={c.key}
                      title={<span className="text-muted-foreground">{`${c.firstName} ${c.lastName}`.trim()}</span>}
                      subtitle={describe(c)}
                      chevron={false}
                      last={i === shown.length - 1}
                    />
                  ) : (
                    <InsetCheckRow
                      key={c.key}
                      label={`${c.firstName} ${c.lastName}`.trim()}
                      subtitle={describe(c) || undefined}
                      detail={c.birthday ? <Cake className="h-4 w-4" aria-label="Has a birthday" /> : undefined}
                      checked={selected.has(c.key)}
                      onToggle={() => toggle(c.key)}
                      last={i === shown.length - 1}
                    />
                  ),
                )}
              </InsetGroup>
            </>
          )}
        </div>
        {fileInput}
      </DialogContent>
    )
  }

  function renderDesktop() {
    return (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            {stage === 'pick' || stage === 'saving'
              ? `Pick who to bring into Retrn. ${already ? `${already} are already here and can't be picked again.` : ''}`
              : 'From a .vcf file — what iCloud, Google Contacts and Outlook export.'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'intro' || stage === 'loading' ? (
          <div className="space-y-3">
            <IntroCopy source={source} compact />
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>iCloud: icloud.com/contacts → select contacts → Export vCard</li>
              <li>Google: contacts.google.com → Export → vCard (for iOS Contacts)</li>
              <li>Mac: Contacts app → select → File → Export → Export vCard</li>
            </ul>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button
              onClick={() => (canReadPhoneContacts ? void fromPhone() : fileRef.current?.click())}
              disabled={stage === 'loading'}
            >
              {stage === 'loading' ? <Loader2 className="animate-spin" /> : <FileUp />}
              {canReadPhoneContacts ? 'Choose from Contacts' : 'Choose .vcf file'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-9" autoFocus />
            </div>
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={allShownSelected} onCheckedChange={toggleAllShown} disabled={selectable.length === 0} />
                Select all{query ? ' shown' : ''}
              </label>
              <span>{count} selected</span>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto rounded-lg border">
              {shown.map((c) => (
                <li key={c.key} className="border-b last:border-b-0">
                  <label
                    className={cn(
                      'flex items-center gap-3 px-3 py-2',
                      c.existingId ? 'opacity-55' : 'cursor-pointer hover:bg-accent/50',
                    )}
                  >
                    <Checkbox
                      checked={!c.existingId && selected.has(c.key)}
                      disabled={Boolean(c.existingId)}
                      onCheckedChange={() => toggle(c.key)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{`${c.firstName} ${c.lastName}`.trim()}</span>
                      {describe(c) && <span className="block truncate text-xs text-muted-foreground">{describe(c)}</span>}
                    </span>
                    {c.birthday && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Birthday">
                        <Cake className="h-3.5 w-3.5" />
                        {formatKeyDate({ ...c.birthday, year: undefined })}
                      </span>
                    )}
                  </label>
                </li>
              ))}
              {filtered.length > RENDER_LIMIT && (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  Showing {RENDER_LIMIT} of {filtered.length}. Search to find someone.
                </li>
              )}
            </ul>
          </div>
        )}

        {(stage === 'pick' || stage === 'saving') && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStage('intro')} disabled={stage === 'saving'}>
              Choose another file
            </Button>
            <Button onClick={() => void save()} disabled={count === 0 || stage === 'saving'}>
              {stage === 'saving' ? 'Importing…' : `Import ${count || ''}`.trim()}
            </Button>
          </DialogFooter>
        )}
        {fileInput}
      </DialogContent>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => stage !== 'saving' && onOpenChange(o)}>
      {isMobile ? renderPhone() : renderDesktop()}
    </Dialog>
  )
}

function IntroCopy({ source, compact }: { source: string; compact?: boolean }) {
  return (
    <p className={cn('text-muted-foreground', compact ? 'text-sm' : 'text-ios-subhead px-4')}>
      Pick the people from {source} worth keeping up with. Only the ones you choose are added
      to Retrn — with their birthdays, so you’re reminded each year.
    </p>
  )
}
