import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { fullName, formatDate } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

interface Props {
  contacts: Contact[]
  limit?: number
}

/** The last few people you saved — the quickest way back to someone you just met. */
export function RecentlyAdded({ contacts, limit = 5 }: Props) {
  const recent = React.useMemo(
    () =>
      [...contacts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    [contacts, limit],
  )

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <h2 className="font-semibold">Recently added</h2>
          </div>
          <Link
            to={ROUTES.contacts}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All contacts
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nobody yet. The people you add show up here first.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  to={ROUTES.contact(c.id)}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent/60"
                >
                  <ContactAvatar contact={c} className="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(c)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(c.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
