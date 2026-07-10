import { useNavigate } from 'react-router-dom'
import { Building2, MapPin, MoreHorizontal } from 'lucide-react'
import { Card } from '@/components/ui/card'
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
import { StrengthMeter } from '@/components/common/StrengthMeter'
import { CONNECTION_TYPES } from '@/lib/constants'
import { fullName, formatRelative } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Contact, Tag } from '@/types'

interface Props {
  contact: Contact
  tagMap: Map<string, Tag>
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}

export function ContactCard({ contact, tagMap, onEdit, onDelete }: Props) {
  const navigate = useNavigate()
  const tags = contact.tagIds
    .map((id) => tagMap.get(id))
    .filter(Boolean) as Tag[]

  return (
    <Card
      onClick={() => navigate(ROUTES.contact(contact.id))}
      className="group flex cursor-pointer flex-col p-4 transition-all hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <ContactAvatar contact={contact} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold leading-tight">
                  {fullName(contact)}
                </h3>
                {contact.connectionType && (
                  <span
                    className="shrink-0 text-sm"
                    title={CONNECTION_TYPES[contact.connectionType].label}
                  >
                    {CONNECTION_TYPES[contact.connectionType].emoji}
                  </span>
                )}
              </div>
              {contact.jobTitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {contact.jobTitle}
                </p>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(contact)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(contact)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {contact.company && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.company}</span>
          </div>
        )}
        {contact.whereWeMet && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.whereWeMet}</span>
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => (
            <TagBadge key={t.id} tag={t} />
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-4">
        <StrengthMeter value={contact.relationshipStrength} />
        <div className="flex items-center gap-2">
          <ReconnectBadge contact={contact} />
          <span className="text-xs text-muted-foreground">
            {contact.lastContactDate
              ? formatRelative(contact.lastContactDate)
              : 'No contact yet'}
          </span>
        </div>
      </div>
    </Card>
  )
}
