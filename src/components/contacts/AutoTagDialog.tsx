import * as React from 'react'
import { Check, Loader2, Sparkles, Tags, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts, useTags } from '@/hooks/useData'
import { contactRepo } from '@/services'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { suggestTagsForContacts, type BulkTagResult } from '@/lib/ai/tagging'
import {
  ensureTags,
  findTagByName,
  suggestTagsLocally,
  type TagSuggestion,
} from '@/lib/tagging'
import { tagColor } from '@/lib/constants'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Cost cap for one pass. Beyond this the run takes the people we know most
 * about — the ones a tag can actually be read off — and says how many it left.
 */
const MAX_PER_RUN = 250

type Scope = 'untagged' | 'all'
type Phase = 'setup' | 'running' | 'review' | 'applying'

/** `${contactId}::${tagName}` — the unit the review list checks off. */
type Key = string
const key = (contactId: string, name: string): Key => `${contactId}::${name}`

/**
 * Tag the whole network in one pass.
 *
 * This is the answer to "tagging is too much work": rather than tagging people
 * one at a time forever, read everyone at once, then approve. The model never
 * writes — every proposed tag arrives checked in a list the user can uncheck,
 * and only the ones still checked when they hit Apply are written.
 *
 * Existing tags are always preferred over new ones (see `lib/ai/tagging.ts`),
 * and a contact's current tags are never removed — a run can only add.
 */
export function AutoTagDialog({ open, onOpenChange }: Props) {
  const contacts = useContacts() ?? []
  const tags = useTags() ?? []

  const [scope, setScope] = React.useState<Scope>('untagged')
  const [phase, setPhase] = React.useState<Phase>('setup')
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })
  const [results, setResults] = React.useState<BulkTagResult>(new Map())
  const [selected, setSelected] = React.useState<Set<Key>>(new Set())
  const [skipped, setSkipped] = React.useState(0)
  const [degraded, setDegraded] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  /** Distinguishes "the user stopped this" from "the run stopped itself". */
  const cancelled = React.useRef(false)

  const untagged = React.useMemo(
    () => contacts.filter((c) => c.tagIds.length === 0),
    [contacts],
  )
  const pool = scope === 'untagged' ? untagged : contacts

  React.useEffect(() => {
    if (open) {
      setPhase('setup')
      setResults(new Map())
      setSelected(new Set())
      setProgress({ done: 0, total: 0 })
      setSkipped(0)
      setDegraded(false)
      // Most people open this because their network is untagged; if it isn't,
      // start on the scope that has anything to do.
      setScope(untagged.length > 0 ? 'untagged' : 'all')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Leaving mid-run should stop the run, not leave it burning in the
  // background against a dialog nobody is looking at.
  React.useEffect(() => {
    if (!open) {
      cancelled.current = true
      abortRef.current?.abort()
    }
  }, [open])

  async function run() {
    const controller = new AbortController()
    abortRef.current = controller
    cancelled.current = false

    // Richest records first: if the cap bites, it should drop the people we
    // know nothing about, who'd get no tags anyway.
    const ordered = [...pool].sort((a, b) => detail(b) - detail(a))
    const batch = ordered.slice(0, MAX_PER_RUN)
    setSkipped(ordered.length - batch.length)
    setProgress({ done: 0, total: batch.length })
    setPhase('running')

    let found: BulkTagResult = new Map()
    let failures = 0
    try {
      if (isAiAvailable()) {
        found = await suggestTagsForContacts(batch, tags, {
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
          onError: (err) => {
            if (err instanceof AiUnavailableError) controller.abort()
            failures += 1
          },
        })
      }
    } catch (err) {
      console.error(err)
    }

    // A cancel is a cancel: don't quietly hand back a rules-based pass
    // nobody asked for. (An abort the *run* triggered — AI turning out to be
    // unavailable — falls through to that pass instead.)
    if (cancelled.current) {
      setPhase('setup')
      return
    }

    // No AI, or it fell over on the way: the rules-based pass still finds
    // people who match tags the user already has.
    if (found.size === 0) {
      setDegraded(true)
      for (const contact of batch) {
        const local = suggestTagsLocally(contact, tags, contact.tagIds)
        if (local.length) found.set(contact.id, local)
      }
    } else if (failures > 0) {
      setDegraded(true)
    }

    const next = new Set<Key>()
    for (const [contactId, suggestions] of found) {
      for (const s of suggestions) next.add(key(contactId, s.name))
    }
    setResults(found)
    setSelected(next)
    setPhase('review')
  }

  function cancelRun() {
    cancelled.current = true
    abortRef.current?.abort()
    setPhase('setup')
  }

  function toggle(contactId: string, name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      const k = key(contactId, name)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function setAll(on: boolean) {
    if (!on) {
      setSelected(new Set())
      return
    }
    const next = new Set<Key>()
    for (const [contactId, suggestions] of results) {
      for (const s of suggestions) next.add(key(contactId, s.name))
    }
    setSelected(next)
  }

  /** Contacts with at least one tag still checked, in reading order. */
  const rows = React.useMemo(() => {
    const out: { contact: Contact; suggestions: TagSuggestion[] }[] = []
    for (const [contactId, suggestions] of results) {
      const contact = contacts.find((c) => c.id === contactId)
      if (contact) out.push({ contact, suggestions })
    }
    return out.sort((a, b) => fullName(a.contact).localeCompare(fullName(b.contact)))
  }, [results, contacts])

  const chosenCount = selected.size
  const peopleCount = rows.filter((r) =>
    r.suggestions.some((s) => selected.has(key(r.contact.id, s.name))),
  ).length

  async function apply() {
    setPhase('applying')
    try {
      // Create every genuinely-new tag once, up front, so twelve people
      // getting "Fintech" produce one tag and not twelve.
      const wanted = new Set<string>()
      for (const { contact, suggestions } of rows) {
        for (const s of suggestions) {
          if (selected.has(key(contact.id, s.name))) wanted.add(s.name)
        }
      }
      const { created } = await ensureTags([...wanted], tags)
      const tagPool = [...tags, ...created]

      let tagged = 0
      for (const { contact, suggestions } of rows) {
        const add: string[] = []
        for (const s of suggestions) {
          if (!selected.has(key(contact.id, s.name))) continue
          const id = findTagByName(s.name, tagPool)?.id
          if (id && !contact.tagIds.includes(id) && !add.includes(id)) add.push(id)
        }
        if (!add.length) continue
        await contactRepo.update(contact.id, { tagIds: [...contact.tagIds, ...add] })
        tagged += 1
      }

      toast.success(
        `Tagged ${tagged} ${tagged === 1 ? 'person' : 'people'}`,
        created.length
          ? {
              description: `${created.length} new ${
                created.length === 1 ? 'tag' : 'tags'
              }: ${created.map((t) => t.name).join(', ')}`,
            }
          : undefined,
      )
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not apply those tags.')
      setPhase('review')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
            Auto-tag your network
          </DialogTitle>
          <DialogDescription>
            {phase === 'review'
              ? 'Uncheck anything you disagree with. Nothing is saved until you apply, and existing tags are never removed.'
              : 'Reads what you already wrote about each person and proposes tags — reusing the tags you have wherever they fit.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'setup' && (
          <div className="space-y-3">
            <ScopeOption
              label="People with no tags"
              count={untagged.length}
              active={scope === 'untagged'}
              onSelect={() => setScope('untagged')}
              hint="The usual pass — everyone you never got round to tagging."
            />
            <ScopeOption
              label="Everyone"
              count={contacts.length}
              active={scope === 'all'}
              onSelect={() => setScope('all')}
              hint="Also proposes additions for people who already have tags."
            />
            {pool.length > MAX_PER_RUN && (
              <p className="text-xs text-muted-foreground">
                This pass reads {MAX_PER_RUN} people at a time, starting with the
                ones you've written most about. Run it again for the rest.
              </p>
            )}
          </div>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-sm">
              Read {progress.done} of {progress.total} people…
            </p>
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={cancelRun}>
              Cancel
            </Button>
          </div>
        )}

        {(phase === 'review' || phase === 'applying') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {chosenCount} {chosenCount === 1 ? 'tag' : 'tags'} across{' '}
                {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                {skipped > 0 && ` · ${skipped} not read this pass`}
              </span>
              {rows.length > 0 && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAll(true)}
                    className="rounded px-1.5 py-0.5 hover:bg-accent"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setAll(false)}
                    className="rounded px-1.5 py-0.5 hover:bg-accent"
                  >
                    None
                  </button>
                </span>
              )}
            </div>

            {degraded && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Some of this pass ran without AI — those suggestions are matches
                against tags you already have.
              </p>
            )}

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing to suggest. There isn't enough on these records yet — a
                company, school, or a line of notes is usually enough.
              </p>
            ) : (
              <div className="max-h-[45vh] space-y-1 overflow-y-auto scrollbar-thin pr-1">
                {rows.map(({ contact, suggestions }) => (
                  <div
                    key={contact.id}
                    className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent/40"
                  >
                    <ContactAvatar contact={contact} className="h-7 w-7 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fullName(contact)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[contact.jobTitle, contact.company]
                          .filter(Boolean)
                          .join(' · ') || 'No company on file'}
                      </p>
                    </div>
                    <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
                      {suggestions.map((s) => {
                        const on = selected.has(key(contact.id, s.name))
                        const color = s.tagId
                          ? tagColor(tags.find((t) => t.id === s.tagId)?.color ?? 'slate')
                          : null
                        return (
                          <button
                            key={s.name}
                            type="button"
                            disabled={phase === 'applying'}
                            onClick={() => toggle(contact.id, s.name)}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity',
                              on
                                ? color?.badge ??
                                    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                                : 'border border-dashed text-muted-foreground opacity-60',
                            )}
                          >
                            {on ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            {s.name}
                            {!s.tagId && <span className="opacity-60">new</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'setup' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void run()}
                disabled={pool.length === 0}
                className="gap-2"
              >
                <Tags className="h-4 w-4" />
                {pool.length === 0
                  ? 'Nobody to tag'
                  : `Read ${Math.min(pool.length, MAX_PER_RUN)} ${
                      Math.min(pool.length, MAX_PER_RUN) === 1 ? 'person' : 'people'
                    }`}
              </Button>
            </>
          )}
          {(phase === 'review' || phase === 'applying') && (
            <>
              <Button
                variant="outline"
                onClick={() => setPhase('setup')}
                disabled={phase === 'applying'}
              >
                Back
              </Button>
              <Button
                onClick={() => void apply()}
                disabled={chosenCount === 0 || phase === 'applying'}
                className="gap-2"
              >
                {phase === 'applying' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {phase === 'applying'
                  ? 'Applying…'
                  : `Apply to ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeOption({
  label,
  count,
  hint,
  active,
  onSelect,
}: {
  label: string
  count: number
  hint: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-primary bg-accent/50' : 'hover:bg-accent/30',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
      >
        {active && <Check className="h-2.5 w-2.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {label} · {count}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}

/** How much there is to read about someone — used to prioritise the cap. */
function detail(c: Contact): number {
  return (
    (c.company ? 2 : 0) +
    (c.jobTitle ? 2 : 0) +
    (c.industry ? 1 : 0) +
    (c.school ? 1 : 0) +
    (c.notes ? 2 : 0) +
    (c.howWeMet ? 1 : 0) +
    (c.whereWeMet ? 1 : 0)
  )
}
