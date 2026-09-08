import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  KanbanSquare,
  Mic,
  Search,
  Sparkles,
  UserPlus,
  Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { useUI } from '@/context/ui-context'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/**
 * The half-dozen things people open this app to do, as one grid of buttons.
 *
 * Every one of these already has a home — a keyboard shortcut, a toolbar, a
 * page. This widget exists because none of that is discoverable on a phone,
 * and because someone who mostly *captures* wants those buttons where they
 * land rather than where the app filed them.
 */
export function QuickActions() {
  const navigate = useNavigate()
  const { openVoiceCapture, openNewContact, openAssistant, openSearch } = useUI()
  const [meetingOpen, setMeetingOpen] = React.useState(false)

  const actions = [
    {
      label: 'Say who you met',
      icon: Mic,
      accent: 'text-indigo-500',
      onClick: openVoiceCapture,
    },
    {
      label: 'New contact',
      icon: UserPlus,
      accent: 'text-emerald-500',
      onClick: openNewContact,
    },
    {
      label: 'Ask the assistant',
      icon: Sparkles,
      accent: 'text-violet-500',
      onClick: () => openAssistant(),
    },
    {
      label: 'Search',
      icon: Search,
      accent: 'text-sky-500',
      onClick: openSearch,
    },
    {
      label: 'New meeting',
      icon: CalendarPlus,
      accent: 'text-amber-500',
      onClick: () => setMeetingOpen(true),
    },
    {
      label: 'Open the board',
      icon: KanbanSquare,
      accent: 'text-rose-500',
      onClick: () => navigate(ROUTES.pipeline),
    },
  ]

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold">Quick actions</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {actions.map(({ label, icon: Icon, accent, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors hover:bg-accent/60"
            >
              <Icon className={cn('h-4 w-4 shrink-0', accent)} />
              <span className="truncate text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </CardContent>

      <EventFormDialog open={meetingOpen} onOpenChange={setMeetingOpen} />
    </Card>
  )
}
