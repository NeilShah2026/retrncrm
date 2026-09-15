import * as React from 'react'
import { toast } from 'sonner'
import { Mic } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { contactRepo } from '@/services'
import { parseSpokenContact } from '@/lib/voiceParse'
import { fullName, todayISO } from '@/lib/format'
import { dismissKeyboard } from '@/lib/keyboard'
import { impactFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { isNative } from '@/lib/platform'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (contact: Contact) => void
}

/**
 * Adding someone on a phone: who, and where you met them. That's the whole
 * form — everything else can wait until there's a reason to write it down.
 * The keyboard is up as the sheet arrives, Return moves to the next field
 * and then adds, and a small microphone fills both fields from one sentence
 * for when typing is the harder option.
 */
export function QuickAddSheet({ open, onOpenChange, onSaved }: Props) {
  const speech = useSpeechRecognition()
  const [name, setName] = React.useState('')
  const [where, setWhere] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [duplicate, setDuplicate] = React.useState<Contact | null>(null)
  const nameRef = React.useRef<HTMLInputElement>(null)
  const whereRef = React.useRef<HTMLInputElement>(null)

  // A fresh, empty sheet every time; the microphone never starts on its own.
  React.useEffect(() => {
    if (open) {
      setName('')
      setWhere('')
      setDuplicate(null)
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
        contactFrequencyGoal: 'none',
      })
      successFeedback()
      toast.success(`${fullName(created)} added`)
      onSaved?.(created)
      onOpenChange(false)
    } catch (err) {
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
          <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center px-2">
            <DialogClose asChild>
              <button
                type="button"
                className="press text-ios-body justify-self-start px-2 py-2 text-brand"
              >
                Cancel
              </button>
            </DialogClose>
            <DialogTitle className="text-ios-headline sm:text-ios-headline">New Contact</DialogTitle>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                tapFeedback()
                void save()
              }}
              className="press text-ios-body justify-self-end px-2 py-2 font-semibold text-brand disabled:text-muted-foreground/50"
            >
              {duplicate ? 'Add anyway' : 'Add'}
            </button>
          </div>
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

          {duplicate && (
            <p className="text-ios-footnote mt-2 px-4 text-warning" aria-live="polite">
              {fullName(duplicate)} is already in your contacts. Tap Add anyway to keep both.
            </p>
          )}

          {speech.supported && (
            <div className="mt-3 flex items-center justify-center">
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
  const where = (after ?? parsed.whereWeMet ?? parsed.howWeMet ?? '').trim()
  // Nothing recognisable as a name yet: show what was heard so it can be fixed.
  return name ? { name, where } : { name: after ? '' : sentence, where }
}
