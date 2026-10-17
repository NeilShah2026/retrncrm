import * as React from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { INTERACTION_TYPES } from '@/lib/constants'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact, Interaction } from '@/types'

/** More than fits; the list scrolls inside the panel. */
const MAX_ROWS = 25

/** "today", "yesterday", "5 days ago" — from a yyyy-mm-dd date. */
function ago(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, (m ?? 1) - 1, d ?? 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${formatDistanceToNowStrict(then, { roundingMethod: 'floor' })} ago`
}

/**
 * Who you last reached out to: every logged conversation across your
 * network, newest first — the call, the coffee, the LinkedIn message — with
 * what it was about.
 */
export function RecentOutreach({ contacts, className }: { contacts: Contact[]; className?: string }) {
  const recent = React.useMemo(() => {
    const all: { contact: Contact; interaction: Interaction }[] = []
    for (const contact of contacts) {
      for (const interaction of contact.interactions) all.push({ contact, interaction })
    }
    return all
      .sort(
        (a, b) =>
          b.interaction.date.localeCompare(a.interaction.date) ||
          b.interaction.createdAt.localeCompare(a.interaction.createdAt),
      )
      .slice(0, MAX_ROWS)
  }, [contacts])

  return (
    <Panel className={cn('flex flex-col', className)}>
      <PanelHeader
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.contacts}>All contacts</Link>
          </Button>
        }
      >
        Recent outreach
      </PanelHeader>

      {recent.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Log a call, coffee or message on a contact and it shows up here.
          </p>
        </div>
      ) : (
        <ul className="scroll-native min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {recent.map(({ contact, interaction }) => (
            <li key={interaction.id} className="border-b last:border-b-0">
              <Link
                to={ROUTES.contact(contact.id)}
                className="flex min-h-11 items-center gap-3 px-4 py-2 transition-colors duration-fast hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none"
              >
                <ContactAvatar contact={contact} className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{fullName(contact)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="text-text-secondary">
                      {INTERACTION_TYPES[interaction.type]?.label ?? 'Note'}
                    </span>
                    {interaction.summary ? ` · ${interaction.summary}` : ''}
                  </span>
                </span>
                <time dateTime={interaction.date} className="shrink-0 text-xs text-muted-foreground">
                  {ago(interaction.date)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
