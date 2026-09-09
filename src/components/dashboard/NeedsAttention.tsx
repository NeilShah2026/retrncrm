import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Coffee } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { CoffeeChatPrepDialog } from '@/components/contacts/CoffeeChatPrepDialog'
import { getReconnectStatus } from '@/lib/reconnect'
import { markCaughtUp } from '@/lib/caughtUp'
import { fullName, formatRelative } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

interface Props {
  contacts: Contact[]
  limit?: number
}

/**
 * The people the reconnect engine says have waited longest, with the two
 * things you'd actually do about it: walk in prepared, or reset the clock.
 */
export function NeedsAttention({ contacts, limit = 6 }: Props) {
  const navigate = useNavigate()
  const [prepContactId, setPrepContactId] = React.useState<string | undefined>()

  const overdue = React.useMemo(
    () =>
      contacts
        .map((contact) => ({ contact, status: getReconnectStatus(contact) }))
        .filter(({ status }) => status.overdue)
        .sort(
          (a, b) =>
            (b.status.overdueBy ?? 0) - (a.status.overdueBy ?? 0) ||
            b.contact.relationshipStrength - a.contact.relationshipStrength,
        )
        .slice(0, limit),
    [contacts, limit],
  )

  return (
    <Panel>
      <PanelHeader
        action={
          overdue.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.contactsOverdue}>View all</Link>
            </Button>
          )
        }
      >
        Needs a nudge
      </PanelHeader>
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold">Needs a nudge</h2>
          </div>
          <Link
            to={ROUTES.contactsOverdue}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>

      {overdue.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Nobody is overdue. Set a cadence on the people you want to stay close
          to and they’ll show up here when it’s time.
        </p>
      ) : (
        <ul>
          {overdue.map(({ contact, status }) => (
            <li
              key={contact.id}
              className="flex items-center gap-3 border-b px-4 last:border-b-0 hover:bg-accent/50"
            >
              <button
                onClick={() => navigate(ROUTES.contact(contact.id))}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2 text-left focus-visible:outline-none"
              >
                <ContactAvatar contact={contact} className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{fullName(contact)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="text-warning">{status.reason}</span> · last spoke{' '}
                    {formatRelative(contact.lastContactDate ?? contact.dateMet)}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={`Prep for ${contact.firstName}`}
                  aria-label={`Prep for ${fullName(contact)}`}
                  onClick={() => setPrepContactId(contact.id)}
                >
                  <Coffee />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={`Caught up with ${contact.firstName}`}
                  aria-label={`Mark caught up with ${fullName(contact)}`}
                  onClick={() => void markCaughtUp(contact)}
                >
                  <Check />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CoffeeChatPrepDialog
        open={Boolean(prepContactId)}
        onOpenChange={(open) => !open && setPrepContactId(undefined)}
        contactId={prepContactId}
      />
    </Panel>
  )
}
