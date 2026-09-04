import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, Check, Coffee } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
 * things you'd actually do about it: walk in prepared, or reset the clock
 * because you already spoke.
 *
 * This replaced a "recent activity" feed. A feed of what already happened is
 * a nice thing to scroll and a bad thing to act on — the whole point of the
 * app is the person you *haven't* spoken to.
 */
export function NeedsAttention({ contacts, limit = 6 }: Props) {
  const navigate = useNavigate()
  const [prepContactId, setPrepContactId] = React.useState<string | undefined>()

  const overdue = React.useMemo(
    () =>
      contacts
        .map((contact) => ({ contact, status: getReconnectStatus(contact) }))
        .filter(({ status }) => status.overdue)
        // Longest-waiting first, with closeness as the tiebreak: a close
        // contact slipping is worth more than an acquaintance slipping.
        .sort(
          (a, b) =>
            (b.status.overdueBy ?? 0) - (a.status.overdueBy ?? 0) ||
            b.contact.relationshipStrength - a.contact.relationshipStrength,
        )
        .slice(0, limit),
    [contacts, limit],
  )

  return (
    <Card>
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
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nobody is overdue. Set a cadence goal on the people you want to
            stay close to and they'll show up here when it's time.
          </p>
        ) : (
          <ul className="divide-y">
            {overdue.map(({ contact, status }) => (
              <li
                key={contact.id}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <button
                  onClick={() => navigate(ROUTES.contact(contact.id))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ContactAvatar contact={contact} className="h-9 w-9 shrink-0 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(contact)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {status.reason} · last spoke{' '}
                      {formatRelative(contact.lastContactDate ?? contact.dateMet)}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={`Prep for ${contact.firstName}`}
                    aria-label={`Prep for ${fullName(contact)}`}
                    onClick={() => setPrepContactId(contact.id)}
                  >
                    <Coffee className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={`Caught up with ${contact.firstName}`}
                    aria-label={`Mark caught up with ${fullName(contact)}`}
                    onClick={() => void markCaughtUp(contact)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CoffeeChatPrepDialog
        open={Boolean(prepContactId)}
        onOpenChange={(open) => !open && setPrepContactId(undefined)}
        contactId={prepContactId}
      />
    </Card>
  )
}
