import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { tagColor } from '@/lib/constants'
import { getReconnectStatus } from '@/lib/reconnect'
import { fullName, formatRelativeShort } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact, Tag } from '@/types'

interface Props {
  contact: Contact
  tagMap: Map<string, Tag>
  /** The last row skips the separator, which stops short of the card's edge. */
  last?: boolean
}

/** One person, as a row in a phone's list: who, where, how long it's been. */
export function ContactListRow({ contact, tagMap, last }: Props) {
  const navigate = useNavigate()
  const tags = contact.tagIds.map((id) => tagMap.get(id)).filter(Boolean) as Tag[]
  const status = getReconnectStatus(contact)
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={() => navigate(ROUTES.contact(contact.id))}
      className="flex w-full items-center gap-3 pl-3 text-left transition-colors duration-fast active:bg-accent"
    >
      <ContactAvatar contact={contact} className="h-9 w-9 shrink-0" />
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3',
          !last && 'hairline-b',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {status.overdue && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-label="Overdue" />
            )}
            <span className="truncate text-[17px] leading-tight tracking-[-0.01em]">
              {fullName(contact)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {tags[0] && (
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', tagColor(tags[0].color).dot)}
                aria-hidden
              />
            )}
            <span className="truncate text-[13px] text-muted-foreground">
              {subtitle ||
                (contact.lastContactDate
                  ? `Last spoke ${formatRelativeShort(contact.lastContactDate)} ago`
                  : 'No contact yet')}
            </span>
          </span>
        </span>
        {subtitle && contact.lastContactDate && (
          <time className="tnum shrink-0 text-[13px] text-muted-foreground">
            {formatRelativeShort(contact.lastContactDate)}
          </time>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      </span>
    </button>
  )
}
