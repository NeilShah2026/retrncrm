import { useNavigate } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { TagBadge } from '@/components/common/TagBadge'
import { ReconnectBadge } from '@/components/common/ReconnectBadge'
import { fullName, formatRelativeShort } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { markCaughtUp } from '@/lib/caughtUp'
import type { Contact, Tag } from '@/types'

interface Props {
  contact: Contact
  tagMap: Map<string, Tag>
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}

/** The grid view's unit: a hairline panel, no shadow, no hover lift. */
export function ContactCard({ contact, tagMap, onEdit, onDelete }: Props) {
  const navigate = useNavigate()
  const tags = contact.tagIds.map((id) => tagMap.get(id)).filter(Boolean) as Tag[]
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' · ')

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(ROUTES.contact(contact.id))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(ROUTES.contact(contact.id))
      }}
      className="group flex cursor-pointer flex-col rounded-lg border bg-card p-3 transition-colors duration-fast hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start gap-3">
        <ContactAvatar contact={contact} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{fullName(contact)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle || contact.whereWeMet || '—'}
          </p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${fullName(contact)}`}
                className="-mr-1 -mt-1 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(contact)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void markCaughtUp(contact)}>
                Caught up today
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(contact)}
                className="text-danger focus:text-danger"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {tags.slice(0, 2).map((t) => (
            <TagBadge key={t.id} tag={t} />
          ))}
          {tags.length > 2 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <ReconnectBadge contact={contact} />
          <time className="tnum">
            {contact.lastContactDate ? formatRelativeShort(contact.lastContactDate) : '—'}
          </time>
        </div>
      </div>
    </div>
  )
}
