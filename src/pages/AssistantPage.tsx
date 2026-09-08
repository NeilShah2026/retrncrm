import { RotateCcw, Sparkles } from 'lucide-react'
import { AssistantChat } from '@/components/ai/AssistantChat'
import { BarButton, MobileNavBar } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { useAssistant } from '@/context/assistant-context'

/**
 * The assistant's own screen.
 *
 * Deliberately not built on PageShell. Every other page is a header above a
 * scrolling stack of cards; a chat is the opposite shape — the *bottom* is
 * pinned and the middle scrolls — and a large title that scrolls away would
 * fight the thread for the same gesture. So this owns its chrome: a thin bar
 * that only exists to name the screen and offer a fresh thread, and the chat
 * taking every remaining pixel.
 */
export function AssistantPage() {
  const { turns, busy, reset } = useAssistant()
  const started = turns.length > 0 || busy

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Phone: the standard navigation bar, so this screen sits in the app's
          hierarchy like every other one. */}
      <MobileNavBar
        chrome={{
          title: 'Assistant',
          largeTitle: false,
          trailing: started ? (
            <BarButton onClick={reset} aria-label="Start a new chat">
              <RotateCcw />
            </BarButton>
          ) : undefined,
        }}
        showCompactTitle
        pinLargeTitle={false}
        separated
      />

      {/* Desktop: a thin bar rather than the usual page header block — a chat
          doesn't need a description, and the space is better spent on thread. */}
      <div className="hidden shrink-0 items-center gap-2 border-b px-6 py-3 md:flex">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <h1 className="text-sm font-semibold">Assistant</h1>
        <p className="truncate text-sm text-muted-foreground">
          — ask about your network, or say what happened
        </p>
        {started && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="ml-auto gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New chat
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <AssistantChat />
      </div>
    </div>
  )
}
