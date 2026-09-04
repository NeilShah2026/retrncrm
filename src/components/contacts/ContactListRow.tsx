import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { tagColor } from '@/lib/constants'
import { getReconnectStatus } from '@/lib/reconnect'
import { fullName, formatRelative } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact, Tag } from '@/types'

interface Props {
  contact: Contact
  tagMap: Map<string, Tag>
  /** The last row skips the separator, which stops short of the card's edge. */
  last?: boolean
}

/**
 * One person, as a row in a phone's list.
 *
 * A card carries a lot of chrome — a border, a shadow, a hover menu, a
 * three-line body — and eight of them fill a phone screen. A row carries the
 * three things you actually scan for (who, where, how long it's been), fits
 * eleven to a screen, and is the shape iOS uses everywhere a list of people
 * appears. Everything the card's menu offered lives one tap deeper, on the
 * person's own screen.
 */
export function ContactListRow({ contact, tagMap, last }: Props) {
  const navigate = useNavigate()
  const tags = contact.tagIds
    .map((id) => tagMap.get(id))
    .filter(Boolean) as Tag[]
  const status = getReconnectStatus(contact)
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={() => navigate(ROUTES.contact(contact.id))}
      className="flex w-full items-center gap-3 pl-3 text-left transition-colors active:bg-accent"
    >
      <ContactAvatar contact={contact} className="h-10 w-10 shrink-0 text-xs" />
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3',
          !last && 'hairline-b',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {/* A dot, not a badge: overdue is worth noticing, not worth a
                second line of text on every row it applies to. */}
            {status.overdue && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            )}
            <span className="truncate text-[17px] leading-tight tracking-[-0.01em]">
              {fullName(contact)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {tags[0] && (
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  tagColor(tags[0].color).dot,
                )}
                aria-hidden
              />
            )}
            <span className="truncate text-[13px] text-muted-foreground">
              {subtitle ||
                (contact.lastContactDate
                  ? `Last spoke ${formatRelative(contact.lastContactDate)}`
                  : 'No contact yet')}
            </span>
          </span>
        </span>
        {subtitle && contact.lastContactDate && (
          <span className="shrink-0 text-[13px] text-muted-foreground">
            {formatRelative(contact.lastContactDate)}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      </span>
    </button>
  )
}
