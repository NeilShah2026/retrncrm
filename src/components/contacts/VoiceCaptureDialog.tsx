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
import { isNative } from '@/lib/platform'
import { useContacts, useTags } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { impactFeedback, successFeedback } from '@/lib/haptics'
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen'
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
import { saveCaptureReminders } from '@/components/reminders/followUpActions'

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
 * One-line contact capture. Say (or type) who you met and the app structures
 * it into a contact you review before saving. On a phone the microphone leads
 * — that is the gesture the feature is named for — with the text box under it
 * for correcting what came back; on a desktop the text box leads and dictation
 * is the secondary control. Either way nothing listens until it is tapped.
 */
export function VoiceCaptureDialog({ open, onOpenChange, onSaved }: Props) {
  const speech = useSpeechRecognition()
  const isMobile = useIsMobile()
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
  const [addedCount, setAddedCount] = React.useState(0)
  const boxRef = React.useRef<HTMLTextAreaElement>(null)
  const keyboardOpen = useKeyboardOpen()
  const [typing, setTyping] = React.useState(false)
  /**
   * The sheet gives the hero over to the form once you're typing in it.
   * Driven by focus, not just the keyboard event: the box takes focus as the
   * sheet mounts, which can raise the keyboard before the plugin listener has
   * even subscribed, so the event alone would be missed on open.
   */
  const compact = typing || keyboardOpen

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
      setAddedCount(0)
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

  /** Clears everything the next person shouldn't inherit. */
  function resetForNext() {
    setText('')
    setEdited(false)
    setDuplicate(null)
    setAi(null)
    autoRan.current = false
    speech.reset()
  }

  async function save(force = false, keepOpen = false) {
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
      await saveCaptureReminders(created.id, parsed)
      successFeedback()
      toast.success(`${fullName(created)} added`)
      onSaved?.(created)
      if (keepOpen) {
        // Bulk entry: stay put, cleared and still focused, so the next name
        // can be typed without a single tap in between.
        setAddedCount((n) => n + 1)
        resetForNext()
        requestAnimationFrame(() => boxRef.current?.focus())
      } else {
        onOpenChange(false)
      }
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
        <DialogContent className="sm:max-w-lg" autoFocusOnOpen>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Say who you met
              {addedCount > 0 && (
                <span className="text-ios-footnote rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
                  {addedCount} added
                </span>
              )}
            </DialogTitle>
            {/* Folds away on its own while the keyboard is up. */}
            <DialogDescription>
              {isMobile && speech.supported
                ? 'Speak or type. We’ll turn it into a contact you can check before saving.'
                : 'Type who you met. We’ll turn it into a contact you can check before saving.'}
            </DialogDescription>
          </DialogHeader>

          {/* On a phone the microphone is the screen, not a button beside a
              box: this is the "say who you met" gesture, and burying it in a
              small secondary control next to a web textarea is what made it
              feel like a form with dictation bolted on. */}
          {isMobile && speech.supported && (
            <div
              className={cn(
                'flex flex-col items-center pb-1 transition-all duration-base',
                compact ? 'gap-1.5 pt-0' : 'gap-3 pt-2',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  impactFeedback()
                  speech.listening ? speech.stop() : speech.start()
                }}
                aria-pressed={speech.listening}
                aria-label={speech.listening ? 'Stop dictating' : 'Start dictating'}
                className={cn(
                  'press-scale relative flex items-center justify-center rounded-full',
                  'transition-all duration-base',
                  compact ? 'h-12 w-12' : 'h-20 w-20',
                  speech.listening
                    ? 'bg-danger text-white'
                    : 'bg-brand text-brand-foreground',
                )}
              >
                {speech.listening && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full bg-danger/30"
                    aria-hidden
                  />
                )}
                {speech.listening ? (
                  <Square className={cn('relative fill-current', compact ? 'h-5 w-5' : 'h-7 w-7')} />
                ) : (
                  <Mic className={cn('relative', compact ? 'h-6 w-6' : 'h-8 w-8')} />
                )}
              </button>
              <p className="text-ios-footnote text-muted-foreground" aria-live="polite">
                {speech.listening
                  ? 'Listening…'
                  : compact
                    ? 'Return saves it and clears for the next person'
                    : 'Tap to speak, or type below'}
              </p>
            </div>
          )}

          {/* The text is primary. */}
          <div className="space-y-2">
            {isMobile ? (
              <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-inset ring-border/70">
                <textarea
                  ref={boxRef}
                  autoFocus
                  value={live}
                  onChange={(e) => {
                    setEdited(true)
                    setText(e.target.value)
                  }}
                  onFocus={() => setTyping(true)}
                  onBlur={() => setTyping(false)}
                  onKeyDown={(e) => {
                    // Return saves and keeps the sheet open for the next
                    // person; Shift+Return is a newline as usual.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (canSave && !saving) void save(Boolean(existingDup), true)
                    }
                  }}
                  enterKeyHint="done"
                  placeholder="Name, where you met, anything useful"
                  aria-label="Who you met"
                  rows={2}
                  className="text-ios-body w-full resize-none bg-transparent px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            ) : (
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
            )}
            <div className={cn('flex flex-wrap items-center gap-2', isMobile && 'justify-center')}>
              {speech.supported && !isMobile && (
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
              {speech.listening && !isMobile && (
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
                {speech.error}{' '}
                {isNative
                  ? 'Allow it in Settings → Retrn.'
                  : 'If the microphone is blocked, allow it from the address bar.'}{' '}
                Typing works either way.
              </p>
            )}
          </div>

          {/* What was picked up */}
          {fields.length > 0 && (
            <div
              className={cn(
                'overflow-hidden',
                isMobile
                  ? 'rounded-[14px] bg-card ring-1 ring-inset ring-border/70'
                  : 'rounded-lg border',
              )}
            >
              {!(isMobile && compact) && (
              <div
                className={cn(
                  'flex h-9 items-center justify-between gap-2 px-3',
                  isMobile ? 'hairline-b' : 'border-b bg-bg-sunken/60',
                )}
              >
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
              )}

              {isMobile && compact ? (
                // Mid-entry the point is a glance, not a table: one line you
                // can check before hitting Return.
                <p className="text-ios-subhead line-clamp-2 px-4 py-2.5">
                  {fields.map((f) => f.value).join(' · ')}
                </p>
              ) : isMobile ? (
                <div>
                  {fields.map((f, i) => (
                    <div key={`${f.key}-${f.value}`} className="flex w-full items-stretch pl-4">
                      <span
                        className={cn(
                          'flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pr-4',
                          i < fields.length - 1 && 'hairline-b',
                        )}
                      >
                        <span className="text-ios-subhead shrink-0 text-muted-foreground">
                          {f.label}
                        </span>
                        <span
                          className={cn(
                            'text-ios-body min-w-0 truncate text-right',
                            changedKeys.has(f.key) && 'text-brand',
                          )}
                        >
                          {f.value}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}

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
