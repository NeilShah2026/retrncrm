import * as React from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, Mic, Pencil, RefreshCw, Square } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SuggestedBadge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ContactFormDialog } from './ContactFormDialog'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useContacts, useTags } from '@/hooks/useData'
import { contactRepo } from '@/services'
import { captureFields, parseSpokenContact } from '@/lib/voiceParse'
import type { ParsedCapture } from '@/lib/voiceParse'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { refineCapture } from '@/lib/ai/capture'
import type { CaptureRefinement } from '@/lib/ai/capture'
import { ensureTags } from '@/lib/tagging'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'
import type { ContactDraft } from '@/services/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (contact: Contact) => void
}

/**
 * How long the sentence has to stop changing before the second read fires.
 */
const IDLE_BEFORE_REFINE_MS = 1200

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
 * One-line contact capture. Type (or dictate) who you met and the app
 * structures it into a contact you review before saving. Text is the primary
 * path; the microphone is a secondary control that only listens when tapped.
 */
export function VoiceCaptureDialog({ open, onOpenChange, onSaved }: Props) {
  const speech = useSpeechRecognition()
  const tags = useTags() ?? []
  const contacts = useContacts() ?? []

  const tagsRef = React.useRef(tags)
  tagsRef.current = tags

  const [text, setText] = React.useState('')
  const [edited, setEdited] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [duplicate, setDuplicate] = React.useState<Contact | null>(null)
  const [handoff, setHandoff] = React.useState<Partial<Contact> | null>(null)
  const [ai, setAi] = React.useState<{ source: string; refinement: CaptureRefinement } | null>(null)
  const [aiBusy, setAiBusy] = React.useState(false)
  const [aiOff, setAiOff] = React.useState(() => !isAiAvailable())

  // Dictation feeds the same box the user can type in.
  React.useEffect(() => {
    if (!edited && speech.transcript) setText(speech.transcript)
  }, [speech.transcript, edited])

  // Fresh sheet every time it opens. The mic does not start on its own.
  React.useEffect(() => {
    if (open) {
      setText('')
      setEdited(false)
      setDuplicate(null)
      setAi(null)
      autoRan.current = false
      speech.reset()
    } else {
      speech.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const live = [text, speech.listening ? speech.interim : ''].filter(Boolean).join(' ')
  const source = live.trim()
  const localParsed = React.useMemo(() => parseSpokenContact(live), [live])

  const refinement = ai?.source === source ? ai.refinement : null
  const parsed = refinement?.parsed ?? localParsed
  const changes = React.useMemo(() => refinement?.changes ?? [], [refinement])
  const changedKeys = React.useMemo(() => new Set(changes.map((c) => c.key)), [changes])
  const fields = React.useMemo(() => captureFields(parsed), [parsed])
  const canSave = Boolean(parsed.firstName)

  const refine = React.useCallback(async (sentence: string) => {
    if (!sentence) return
    setAiBusy(true)
    try {
      const result = await refineCapture(
        sentence,
        parseSpokenContact(sentence),
        tagsRef.current.map((t) => t.name),
      )
      setAi({ source: sentence, refinement: result })
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        setAiOff(true)
      } else {
        console.error(err)
        toast.error('Couldn’t re-read that. What was picked up still stands.')
      }
    } finally {
      setAiBusy(false)
    }
  }, [])

  // Run the second read once, automatically, when the text settles.
  const autoRan = React.useRef(false)
  React.useEffect(() => {
    if (!open || aiOff || aiBusy || saving || autoRan.current) return
    if (speech.listening && !edited) return
    if (source.length < 15 || ai?.source === source) return
    const timer = setTimeout(() => {
      autoRan.current = true
      void refine(source)
    }, IDLE_BEFORE_REFINE_MS)
    return () => clearTimeout(timer)
  }, [speech.listening, edited, open, aiOff, aiBusy, saving, source, ai, refine])

  async function resolveTags(names: string[]): Promise<string[]> {
    const { ids } = await ensureTags(names, tags)
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
      toast.success(`${fullName(created)} added`)
      onSaved?.(created)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save that contact.')
    } finally {
      setSaving(false)
    }
  }

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
              Type who you met. We’ll turn it into a contact you can check before saving.
            </DialogDescription>
          </DialogHeader>

          {/* The text is primary. */}
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={live}
              onChange={(e) => {
                setEdited(true)
                setText(e.target.value)
              }}
              placeholder="Name, where you met, anything useful"
              aria-label="Who you met"
              className="min-h-[96px] text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              {speech.supported && (
                <Button
                  type="button"
                  variant={speech.listening ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => (speech.listening ? speech.stop() : speech.start())}
                  aria-pressed={speech.listening}
                >
                  {speech.listening ? (
                    <>
                      <Square className="fill-current text-danger" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic />
                      Dictate
                    </>
                  )}
                </Button>
              )}
              {speech.listening && (
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  Listening…
                </span>
              )}
              {live && !speech.listening && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setText('')
                    setEdited(false)
                    setAi(null)
                    autoRan.current = false
                    speech.reset()
                  }}
                >
                  Start over
                </Button>
              )}
            </div>
            {speech.error && (
              <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
                {speech.error} If the microphone is blocked, allow it from the address bar. Typing
                works either way.
              </p>
            )}
          </div>

          {/* What was picked up */}
          {fields.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <div className="flex h-9 items-center justify-between gap-2 border-b bg-bg-sunken/60 px-3">
                <span className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                  Picked up
                  {refinement && <SuggestedBadge>Checked</SuggestedBadge>}
                </span>
                {!aiOff && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void refine(source)}
                    disabled={aiBusy || !source || ai?.source === source}
                    loading={aiBusy}
                    className="-mr-2 text-muted-foreground"
                  >
                    {!aiBusy && <RefreshCw />}
                    {aiBusy ? 'Reading again' : 'Check again'}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 p-3">
                {fields.map((f) => (
                  <span
                    key={`${f.key}-${f.value}`}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 text-xs',
                      changedKeys.has(f.key) && 'border-brand/40',
                    )}
                  >
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium">{f.value}</span>
                  </span>
                ))}
              </div>

              {changes.length > 0 && (
                <ul className="space-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
                  {changes.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-center gap-1">
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
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {aiBusy ? (
                'Reading that again…'
              ) : (
                <>
                  Couldn’t find a name yet. Try “met <em>Sarah Chen</em> at…”.
                  {!aiOff && ai?.source !== source && source.length >= 15 && (
                    <button
                      type="button"
                      onClick={() => void refine(source)}
                      className="ml-1 font-medium text-brand hover:underline"
                    >
                      Check again
                    </button>
                  )}
                </>
              )}
            </p>
          )}

          {existingDup && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-0.5">
                <p className="font-medium">
                  {fullName(existingDup)} is already in your network
                  {existingDup.company ? ` (${existingDup.company})` : ''}.
                </p>
                <p className="text-muted-foreground">Save anyway to keep both, or start over.</p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={openFullForm} disabled={!live.trim()}>
              <Pencil />
              Add details
            </Button>
            <Button
              type="button"
              onClick={() => void save(Boolean(existingDup))}
              disabled={!canSave}
              loading={saving}
            >
              {existingDup ? 'Save anyway' : 'Save contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactFormDialog
        open={Boolean(handoff)}
        onOpenChange={(o) => !o && setHandoff(null)}
        prefill={handoff ?? undefined}
        onSaved={onSaved}
      />
    </>
  )
}
