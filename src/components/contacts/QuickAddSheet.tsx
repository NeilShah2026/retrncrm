import * as React from 'react'
import { toast } from 'sonner'
import { AlarmClock, Cake, Loader2, Mic, ScanLine, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  SheetBar,
  SheetBarButton,
} from '@/components/ui/dialog'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { contactRepo } from '@/services'
import { useAuth } from '@/auth/AuthProvider'
import { defaultContactFrequency } from '@/lib/onboarding'
import { parseSpokenContact } from '@/lib/voiceParse'
import { saveCaptureReminders } from '@/components/reminders/followUpActions'
import { CardScanError, scanBusinessCard } from '@/lib/ai/cardScan'
import { AiUnavailableError } from '@/lib/ai/client'
import { describeDue, dueInSentence } from '@/lib/followUps'
import { formatKeyDate } from '@/lib/keyDates'
import { fullName, todayISO } from '@/lib/format'
import { dismissKeyboard } from '@/lib/keyboard'
import { impactFeedback, successFeedback } from '@/lib/haptics'
import { isNative } from '@/lib/platform'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'
import { isContactLimitError } from '@/lib/billing/contactLimit'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (contact: Contact) => void
  /** A business card was read; the caller opens the full form with it. */
  onCardScanned?: (fields: Partial<Contact>) => void
}

/**
 * Adding someone on a phone: who, and where you met them. That's the whole
 * form — everything else can wait until there's a reason to write it down.
 * The keyboard is up as the sheet arrives, Return moves to the next field
 * and then adds, and a small microphone fills both fields from one sentence
 * for when typing is the harder option.
 */
export function QuickAddSheet({ open, onOpenChange, onSaved, onCardScanned }: Props) {
  const { user } = useAuth()
  const speech = useSpeechRecognition()
  const [name, setName] = React.useState('')
  const [where, setWhere] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [duplicate, setDuplicate] = React.useState<Contact | null>(null)
  /** Reminders read out of the sentence that the user has waved away. */
  const [dismissed, setDismissed] = React.useState({ followUp: false, birthday: false })
  const nameRef = React.useRef<HTMLInputElement>(null)
  const whereRef = React.useRef<HTMLInputElement>(null)
  const cardRef = React.useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = React.useState(false)

  async function scanCard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onCardScanned) return
    speech.stop()
    setScanning(true)
    try {
      const fields = await scanBusinessCard(file)
      successFeedback()
      // Whatever was already typed about where you met comes along too.
      onCardScanned({ ...fields, whereWeMet: where.trim() || undefined, dateMet: todayISO() })
    } catch (err) {
      if (err instanceof AiUnavailableError) toast.error('Card scanning isn’t available right now.')
      else if (err instanceof CardScanError) toast.error(err.message)
      else {
        console.error(err)
        toast.error('Couldn’t read that card. Try again.')
      }
    } finally {
      setScanning(false)
    }
  }

  // A fresh, empty sheet every time; the microphone never starts on its own.
  React.useEffect(() => {
    if (open) {
      setName('')
      setWhere('')
      setDuplicate(null)
      setDismissed({ followUp: false, birthday: false })
      speech.reset()
    } else {
      speech.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // What's being said lands in the fields as it's said.
  const spoken = [speech.transcript, speech.listening ? speech.interim : '']
    .filter(Boolean)
    .join(' ')
    .trim()
  React.useEffect(() => {
    if (!spoken) return
    const heard = splitSpoken(spoken)
    setName(heard.name)
    setWhere(heard.where)
    setDuplicate(null)
  }, [spoken])

  // "…email her back in December" or "her birthday's March 3": whatever was
  // said (or typed into either field) past the name and the place.
  const extras = React.useMemo(() => {
    const parsed = parseSpokenContact(spoken || [name, where].filter(Boolean).join('. '))
    return {
      followUp: dismissed.followUp ? undefined : parsed.followUp,
      birthday: dismissed.birthday ? undefined : parsed.birthday,
    }
  }, [spoken, name, where, dismissed])

  const trimmedName = name.trim()
  const canSave = Boolean(trimmedName) && !saving

  async function save() {
    if (!canSave) return
    speech.stop()
    const [firstName, ...rest] = trimmedName.split(/\s+/)
    const lastName = rest.join(' ')
    setSaving(true)
    try {
      // Asked once: a second tap on "Add anyway" means keep both.
      if (!duplicate) {
        const [existing] = await contactRepo.findDuplicates(firstName, lastName)
        if (existing) {
          setDuplicate(existing)
          return
        }
      }
      const today = todayISO()
      const created = await contactRepo.create({
        firstName,
        lastName,
        whereWeMet: where.trim() || undefined,
        dateMet: today,
        lastContactDate: today,
        otherLinks: [],
        tagIds: [],
        relationshipStrength: 2,
        // The reconnect goal chosen during onboarding, so a contact added
        // the fast way still arrives with a cadence on it.
        contactFrequencyGoal: defaultContactFrequency(user),
      })
      await saveCaptureReminders(created.id, extras)
      successFeedback()
      toast.success(
        extras.followUp
          ? `${fullName(created)} added · follow up ${dueInSentence(extras.followUp.dueDate)}`
          : `${fullName(created)} added`,
      )
      onSaved?.(created)
      onOpenChange(false)
    } catch (err) {
      // The upgrade prompt is already up; a second error would just be noise.
      if (isContactLimitError(err)) return
      console.error(err)
      toast.error('Couldn’t add them. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function toggleSpeech() {
    impactFeedback()
    if (speech.listening) {
      speech.stop()
      return
    }
    // Listening is easier to follow with the fields in view, not the keyboard.
    dismissKeyboard()
    speech.reset()
    speech.start()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        padded={false}
        aria-describedby={undefined}
        // Straight into the name field: this sheet exists to be typed into.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          nameRef.current?.focus({ preventScroll: true })
        }}
      >
        <DialogHeader>
          <SheetBar
            leading={<SheetBarButton close>Cancel</SheetBarButton>}
            title="New Contact"
            trailing={
              <SheetBarButton strong disabled={!canSave} onClick={() => void save()}>
                {duplicate ? 'Add anyway' : 'Add'}
              </SheetBarButton>
            }
          />
        </DialogHeader>

        <form
          className="px-4 pb-[max(1rem,var(--safe-bottom))] pt-3 keyboard-padding"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="overflow-hidden rounded-[14px] bg-bg-sunken">
            <Field
              ref={nameRef}
              label="Name"
              value={name}
              onChange={(v) => {
                setName(v)
                setDuplicate(null)
              }}
              autoCapitalize="words"
              enterKeyHint="next"
              onEnter={() => whereRef.current?.focus({ preventScroll: true })}
            />
            <div className="ml-4 h-px bg-border" />
            <Field
              ref={whereRef}
              label="Where you met"
              value={where}
              onChange={setWhere}
              autoCapitalize="sentences"
              enterKeyHint="done"
              onEnter={() => void save()}
            />
          </div>

          {(extras.followUp || extras.birthday) && (
            <div className="mt-2 flex flex-col gap-1.5">
              {extras.followUp && (
                <ExtraChip
                  icon={AlarmClock}
                  label={`Follow up ${describeDue(extras.followUp.dueDate)}`}
                  detail={extras.followUp.note}
                  onDismiss={() => setDismissed((d) => ({ ...d, followUp: true }))}
                />
              )}
              {extras.birthday && (
                <ExtraChip
                  icon={Cake}
                  label={`Birthday ${formatKeyDate(extras.birthday)}`}
                  onDismiss={() => setDismissed((d) => ({ ...d, birthday: true }))}
                />
              )}
            </div>
          )}

          {duplicate && (
            <p className="text-ios-footnote mt-2 px-4 text-warning" aria-live="polite">
              {fullName(duplicate)} is already in your contacts. Tap Add anyway to keep both.
            </p>
          )}

          {(speech.supported || onCardScanned) && (
            <div className="mt-3 flex items-center justify-center gap-1">
              {onCardScanned && (
                <>
                  <button
                    type="button"
                    onClick={() => cardRef.current?.click()}
                    disabled={scanning}
                    className="press text-ios-subhead flex h-9 items-center gap-2 rounded-full px-3.5 text-muted-foreground disabled:opacity-60"
                  >
                    {scanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanLine className="h-4 w-4" strokeWidth={2.2} />
                    )}
                    {scanning ? 'Reading card…' : 'Scan a card'}
                  </button>
                  <input
                    ref={cardRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void scanCard(e)}
                  />
                </>
              )}
              {speech.supported && (
              <button
                type="button"
                onClick={toggleSpeech}
                aria-pressed={speech.listening}
                className={cn(
                  'press text-ios-subhead flex h-9 items-center gap-2 rounded-full px-3.5',
                  speech.listening
                    ? 'bg-danger-soft text-danger'
                    : 'text-muted-foreground',
                )}
              >
                <span className="relative flex h-4 w-4 items-center justify-center">
                  {speech.listening && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" aria-hidden />
                  )}
                  <Mic className="relative h-4 w-4" strokeWidth={2.2} />
                </span>
                {speech.listening ? 'Listening… tap to stop' : 'Or say it'}
              </button>
              )}
            </div>
          )}

          {speech.error && (
            <p className="text-ios-footnote mt-2 px-4 text-center text-muted-foreground">
              {speech.error} {isNative ? 'Allow it in Settings → Retrn.' : ''}
            </p>
          )}

        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A reminder the sentence will also set, with a way to not. */
function ExtraChip({
  icon: Icon,
  label,
  detail,
  onDismiss,
}: {
  icon: typeof Mic
  label: string
  detail?: string
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] bg-brand/[0.08] py-1.5 pl-3.5 pr-1">
      <Icon className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.2} />
      <span className="text-ios-subhead min-w-0 flex-1 truncate">
        <span className="font-medium text-brand">{label}</span>
        {detail && <span className="text-text-secondary"> · {detail}</span>}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Don’t set: ${label}`}
        className="press flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** One field of the grouped card: the placeholder is the label, as in iOS forms. */
const Field = React.forwardRef<
  HTMLInputElement,
  {
    label: string
    value: string
    onChange: (value: string) => void
    onEnter: () => void
    autoCapitalize: string
    enterKeyHint: 'next' | 'done'
  }
>(({ label, value, onChange, onEnter, autoCapitalize, enterKeyHint }, ref) => (
  <input
    ref={ref}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onEnter()
      }
    }}
    placeholder={label}
    aria-label={label}
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize={autoCapitalize}
    enterKeyHint={enterKeyHint}
    className="text-ios-body h-12 w-full min-w-0 bg-transparent px-4 text-foreground outline-none placeholder:text-muted-foreground"
  />
))
Field.displayName = 'Field'

/**
 * "Priya Shah at the AI meetup" → Priya Shah / AI meetup. The parser is good
 * at names; the place is simply whatever follows "at", "from" or "in".
 */
function splitSpoken(sentence: string): { name: string; where: string } {
  const parsed = parseSpokenContact(sentence)
  const name = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ')
  const after = sentence.match(/\b(?:at|from|during|in)\s+(?:the\s+|a\s+|an\s+)?(.+)$/i)?.[1]
  // A place stops at the first break: "the career fair, email her back in
  // December" is the career fair plus a follow-up, not one long place.
  const where = (after ?? parsed.whereWeMet ?? parsed.howWeMet ?? '')
    .split(/\s*(?:[,.;]|—|\s-\s)\s*/)[0]
    .trim()
  // Nothing recognisable as a name yet: show what was heard so it can be fixed.
  return name ? { name, where } : { name: after ? '' : sentence, where }
}
