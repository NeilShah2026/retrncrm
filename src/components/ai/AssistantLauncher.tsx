import * as React from 'react'
import { Mic, Send, Sparkles } from 'lucide-react'
import { useUI } from '@/context/ui-context'
import { cn } from '@/lib/utils'

/** Rotating examples — the phone screen has room for one at a time. */
const EXAMPLES = [
  'Met Priya at the AI meetup — PM at Klaviyo',
  'Coffee with Sarah next Tuesday at 3',
  'Who do I know in fintech?',
  'I spoke to Marcus today',
  'Who should I reconnect with this week?',
]

const ROTATE_MS = 4000

/**
 * The assistant, as the first thing on the phone's home screen.
 *
 * On a laptop the assistant is one affordance among many — a sidebar item, a
 * ⌘K entry, a box inside the briefing card. On a phone there is no sidebar and
 * no keyboard shortcut, and typing a sentence beats navigating to a form, so
 * this is the top of the page and the widest thing on it.
 *
 * It deliberately doesn't answer inline: it hands what you typed to the
 * assistant sheet, which has the room for a thread, an action plan, and the
 * approval step.
 */
export function AssistantLauncher({ className }: { className?: string }) {
  const { openAssistant, openVoiceCapture } = useUI()
  const [value, setValue] = React.useState('')
  const [example, setExample] = React.useState(0)

  // Cycling the placeholder is how someone learns this box takes instructions
  // and not just questions — one static hint only ever teaches one of them.
  React.useEffect(() => {
    if (value) return
    const timer = setInterval(
      () => setExample((i) => (i + 1) % EXAMPLES.length),
      ROTATE_MS,
    )
    return () => clearInterval(timer)
  }, [value])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        openAssistant(value.trim() || undefined)
        setValue('')
      }}
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.09] to-indigo-500/[0.02] p-2 pl-3',
        className,
      )}
    >
      <Sparkles className="h-5 w-5 shrink-0 text-indigo-500" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={EXAMPLES[example]}
        aria-label="Ask the assistant, or tell it what happened"
        className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground/80"
      />
      {value.trim() ? (
        <button
          type="submit"
          aria-label="Send to the assistant"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition-transform active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openVoiceCapture}
          aria-label="Say who you met"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/80 text-indigo-600 ring-1 ring-indigo-500/25 transition-transform active:scale-95 dark:text-indigo-300"
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
