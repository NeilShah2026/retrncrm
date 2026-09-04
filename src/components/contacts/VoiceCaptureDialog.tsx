import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Mic,
  Pencil,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ContactFormDialog } from './ContactFormDialog'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useContacts, useTags } from '@/hooks/useData'
import { contactRepo, tagRepo } from '@/services'
import { captureFields, parseSpokenContact } from '@/lib/voiceParse'
import type { ParsedCapture } from '@/lib/voiceParse'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { refineCapture } from '@/lib/ai/capture'
import type { CaptureRefinement } from '@/lib/ai/capture'
import { TAG_COLOR_KEYS } from '@/lib/constants'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'
import type { ContactDraft } from '@/services/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (contact: Contact) => void
}

const EXAMPLES = [
  'Met Sarah Chen at the career fair — she’s a PM at Fidelity, Babson alum, class of 2022. Follow up in a month.',
  'Add Marcus Webb, recruiter at Deloitte, met him at the info session.',
  'Talked to Priya on the flight to Chicago, she’s a founder, tag her startups.',
]

/** Turn the parsed capture into the draft the repository expects. */
function toDraft(parsed: ParsedCapture, tagIds: string[]): ContactDraft {
  return {
    firstName: parsed.firstName?.trim() ?? '',
    lastName: parsed.lastName?.trim() ?? '',
    company: parsed.company,
    jobTitle: parsed.jobTitle,
    email: parsed.email,
    phone: parsed.phone,
    linkedinUrl: parsed.linkedinUrl,
    otherLinks: [],
    connectionType: parsed.connectionType,
    source: parsed.source,
    school: parsed.school,
    gradYear: parsed.gradYear,
    major: parsed.major,
    howWeMet: parsed.howWeMet,
    whereWeMet: parsed.whereWeMet,
    dateMet: parsed.dateMet,
    tagIds,
    relationshipStrength: 2,
    lastContactDate: parsed.dateMet,
    contactFrequencyGoal: parsed.contactFrequencyGoal ?? 'none',
    notes: parsed.notes,
  }
}

/**
 * One-sentence contact capture. Speak (or type) how you met someone and the
 * app fills the form for you — the point being that meeting a person should
 * cost a sentence, not a form. Recognition runs in the browser, so there's no
 * transcription bill and no audio leaving the device's browser session.
 */
export function VoiceCaptureDialog({ open, onOpenChange, onSaved }: Props) {
  const speech = useSpeechRecognition()
  const tags = useTags() ?? []
  const contacts = useContacts() ?? []

  const [text, setText] = React.useState('')
  // True once the user edits by hand — dictation stops overwriting it.
  const [edited, setEdited] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [duplicate, setDuplicate] = React.useState<Contact | null>(null)
  const [handoff, setHandoff] = React.useState<Partial<Contact> | null>(null)
  const [example] = React.useState(
    () => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)],
  )
  // The second read, tied to the exact sentence it was run on — edit the
  // sentence and it's stale, so we drop back to the local parse.
  const [ai, setAi] = React.useState<
    { source: string; refinement: CaptureRefinement } | null
  >(null)
  const [aiBusy, setAiBusy] = React.useState(false)
  const [aiOff, setAiOff] = React.useState(() => !isAiAvailable())

  // Dictation feeds the same box the user can type in.
  React.useEffect(() => {
    if (!edited && speech.transcript) setText(speech.transcript)
  }, [speech.transcript, edited])

  // Fresh sheet every time it opens, and start listening straight away —
  // one tap to open, then just talk.
  React.useEffect(() => {
    if (open) {
      setText('')
      setEdited(false)
      setDuplicate(null)
      setAi(null)
      speech.reset()
      if (speech.supported) speech.start()
    } else {
      speech.stop()
    }
    // Only re-run on open/close; the speech callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const live = [text, speech.listening ? speech.interim : '']
    .filter(Boolean)
    .join(' ')
  const source = live.trim()
  const localParsed = React.useMemo(() => parseSpokenContact(live), [live])

  // The regex parse is what you see while you talk — instant, free, offline.
  // A second read only ever supersedes it for the exact sentence it ran on.
  const refinement = ai?.source === source ? ai.refinement : null
  const parsed = refinement?.parsed ?? localParsed
  const changes = React.useMemo(() => refinement?.changes ?? [], [refinement])
  const changedKeys = React.useMemo(
    () => new Set(changes.map((c) => c.key)),
    [changes],
  )
  const fields = React.useMemo(() => captureFields(parsed), [parsed])
  const canSave = Boolean(parsed.firstName)

  /**
   * One request, on an explicit stop or tap — never per keystroke. Failure is
   * a no-op: the local parse is still sitting there, still savable.
   */
  const refine = React.useCallback(async (sentence: string) => {
    if (!sentence) return
    setAiBusy(true)
    try {
      const result = await refineCapture(sentence, parseSpokenContact(sentence))
      setAi({ source: sentence, refinement: result })
      if (result.changes.length === 0) {
        toast.info('Nothing to add — we already had it all.')
      }
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        setAiOff(true)
      } else {
        console.error(err)
        toast.error('Couldn’t double-check that one — what we heard still stands.')
      }
    } finally {
      setAiBusy(false)
    }
  }, [])

  // Run it once when dictation stops: that's the moment the sentence is
  // finished, and it saves a tap on the path we want to be effortless.
  const wasListening = React.useRef(false)
  React.useEffect(() => {
    const justStopped = wasListening.current && !speech.listening
    wasListening.current = speech.listening
    if (!open || aiOff || aiBusy || !justStopped) return
    if (!source || ai?.source === source) return
    void refine(source)
  }, [speech.listening, open, aiOff, aiBusy, source, ai, refine])

  /** Match spoken tag names to existing tags, creating the ones that are new. */
  async function resolveTags(names: string[]): Promise<string[]> {
    const ids: string[] = []
    for (const name of names) {
      const existing = tags.find(
        (t) => t.name.toLowerCase() === name.toLowerCase(),
      )
      if (existing) {
        ids.push(existing.id)
        continue
      }
      const color = TAG_COLOR_KEYS[(tags.length + ids.length) % TAG_COLOR_KEYS.length]
      const created = await tagRepo.create({ name, color })
      ids.push(created.id)
    }
    return ids
  }

  async function save(force = false) {
    if (!canSave) return
    speech.stop()
    setSaving(true)
    try {
      if (!force) {
        const dups = await contactRepo.findDuplicates(
          parsed.firstName ?? '',
          parsed.lastName ?? '',
          parsed.company,
        )
        if (dups.length) {
          setDuplicate(dups[0])
          setSaving(false)
          return
        }
      }
      const tagIds = await resolveTags(parsed.tagNames)
      const created = await contactRepo.create(toDraft(parsed, tagIds))
      toast.success(`${fullName(created)} added`, {
        description: 'Captured from one sentence — no form required.',
      })
      onSaved?.(created)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save that contact.')
    } finally {
      setSaving(false)
    }
  }

  /** Hand what we heard to the full form for anything the parser missed. */
  function openFullForm() {
    speech.stop()
    setHandoff(toDraft(parsed, []) as Partial<Contact>)
    onOpenChange(false)
  }

  const existingDup = duplicate
    ? contacts.find((c) => c.id === duplicate.id) ?? duplicate
    : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Say who you met</DialogTitle>
            <DialogDescription>
              One sentence is enough — name, where you met, anything you
              remember. We fill in the rest.
            </DialogDescription>
          </DialogHeader>

          {/* Mic */}
          <div className="flex flex-col items-center gap-3 py-2">
            {speech.supported ? (
              <button
                type="button"
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                aria-label={speech.listening ? 'Stop dictating' : 'Start dictating'}
                className={cn(
                  'relative flex h-16 w-16 items-center justify-center rounded-full transition-colors',
                  speech.listening
                    ? 'bg-red-500 text-white'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600',
                )}
              >
                {speech.listening && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
                )}
                {speech.listening ? (
                  <Square className="relative h-5 w-5 fill-current" />
                ) : (
                  <Mic className="relative h-6 w-6" />
                )}
              </button>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Pencil className="h-6 w-6" />
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {speech.listening
                ? 'Listening… tap to stop'
                : speech.supported
                  ? 'Tap to talk, or just type below'
                  : 'This browser can’t listen — type it below (your phone keyboard’s mic works too)'}
            </p>
          </div>

          {speech.error && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {speech.error} You can still type it below.
            </p>
          )}

          {/* Transcript */}
          <div className="space-y-2">
            <Textarea
              value={live}
              onChange={(e) => {
                setEdited(true)
                setText(e.target.value)
              }}
              placeholder={example}
              className="min-h-[90px] text-sm"
            />
            {live && (
              <button
                type="button"
                onClick={() => {
                  setText('')
                  setEdited(false)
                  speech.reset()
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3 w-3" />
                Start over
              </button>
            )}
          </div>

          {/* What we heard */}
          {fields.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Picked up
                </p>
                {!aiOff && (
                  <button
                    type="button"
                    onClick={() => void refine(source)}
                    disabled={aiBusy || !source || ai?.source === source}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:opacity-50 dark:text-indigo-400"
                  >
                    {aiBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {aiBusy
                      ? 'Reading again…'
                      : ai?.source === source
                        ? 'Double-checked'
                        : 'Double-check with AI'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                  <span
                    key={`${f.key}-${f.value}`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs',
                      changedKeys.has(f.key) &&
                        'border-indigo-400/60 bg-indigo-500/[0.07] dark:border-indigo-400/40',
                    )}
                  >
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium">{f.value}</span>
                  </span>
                ))}
              </div>

              {/* Exactly what the second read changed — you approve it, not it. */}
              {changes.length > 0 && (
                <ul className="space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                  {changes.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-center gap-1">
                      <Sparkles className="h-3 w-3 shrink-0 text-indigo-500" />
                      <span>{c.label}</span>
                      {c.from && (
                        <>
                          <span className="line-through">{c.from}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                        </>
                      )}
                      <span className="font-medium text-foreground">{c.to}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {live && !canSave && (
            <p className="text-xs text-muted-foreground">
              Couldn’t catch a name yet — try “met <em>Sarah Chen</em> at…”.
            </p>
          )}

          {existingDup && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {fullName(existingDup)} is already in your network
                  {existingDup.company ? ` (${existingDup.company})` : ''}.
                </p>
                <p className="text-muted-foreground">
                  Save anyway to keep both, or start over.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={openFullForm}
              disabled={!live.trim()}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              Add details
            </Button>
            <Button
              type="button"
              onClick={() => void save(Boolean(existingDup))}
              disabled={!canSave || saving}
              className="gap-1.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {existingDup ? 'Save anyway' : 'Save contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "Add details" continues in the full form, pre-filled with what we heard. */}
      <ContactFormDialog
        open={Boolean(handoff)}
        onOpenChange={(o) => !o && setHandoff(null)}
        prefill={handoff ?? undefined}
        onSaved={onSaved}
      />
    </>
  )
}
