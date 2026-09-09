import * as React from 'react'
import { ArrowUp, Mic } from 'lucide-react'
import { useUI } from '@/context/ui-context'
import { cn } from '@/lib/utils'

/** Rotating examples — the phone screen has room for one at a time. */
const EXAMPLES = [
  'Met Priya at the AI meetup, PM at Klaviyo',
  'Who do I know in fintech?',
  'Coffee with Sarah next Tuesday at 3',
  'Who should I reconnect with this week?',
]

const ROTATE_MS = 4000

/**
 * The assistant's entry point on the phone's home screen: a plain text
 * field. It hands what you typed to the assistant screen, which has room
 * for a thread and the approval step.
 */
export function AssistantLauncher({ className }: { className?: string }) {
  const { openAssistant, openVoiceCapture } = useUI()
  const [value, setValue] = React.useState('')
  const [example, setExample] = React.useState(0)

  React.useEffect(() => {
    if (value) return
    const timer = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), ROTATE_MS)
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
        'flex h-11 items-center gap-1 rounded-lg border bg-background pl-3 pr-1.5 transition-colors duration-fast focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25',
        className,
      )}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={EXAMPLES[example]}
        aria-label="Ask about your network, or say who you met"
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80"
      />
      {value.trim() ? (
        <button
          type="submit"
          aria-label="Send"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openVoiceCapture}
          aria-label="Say who you met"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
