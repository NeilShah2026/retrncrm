import { RotateCcw } from 'lucide-react'
import { AssistantChat } from '@/components/ai/AssistantChat'
import { BarButton, MobileNavBar } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { useAssistant } from '@/context/assistant-context'

/**
 * The assistant's own screen: a thin bar naming it, and the thread taking
 * every remaining pixel. Not built on PageShell because a chat pins the
 * bottom, not the top.
 */
export function AssistantPage() {
  const { turns, busy, reset } = useAssistant()
  const started = turns.length > 0 || busy

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MobileNavBar
        chrome={{
          title: 'Assistant',
          largeTitle: false,
          trailing: started ? (
            <BarButton onClick={reset} aria-label="Start a new thread">
              <RotateCcw />
            </BarButton>
          ) : undefined,
        }}
        showCompactTitle
        pinLargeTitle={false}
        separated
      />

      <div className="hidden h-12 shrink-0 items-center gap-3 border-b px-6 md:flex">
        <h1 className="text-sm font-semibold">Assistant</h1>
        <p className="truncate text-sm text-muted-foreground">
          Ask about your network, or say what happened.
        </p>
        {started && (
          <Button variant="ghost" size="sm" onClick={reset} className="ml-auto text-muted-foreground">
            <RotateCcw />
            New thread
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <AssistantChat />
      </div>
    </div>
  )
}
