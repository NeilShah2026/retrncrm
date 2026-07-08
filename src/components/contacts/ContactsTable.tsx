import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
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
import { CONNECTION_TYPES } from '@/lib/constants'
import { fullName, formatDate, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import type { SortDir, SortKey } from '@/lib/filters'
import type { Contact, Tag } from '@/types'

interface Props {
  contacts: Contact[]
  tagMap: Map<string, Tag>
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <th className={cn('bg-muted px-3 py-2 text-left font-medium', className)}>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

export function ContactsTable({
  contacts,
  tagMap,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: Props) {
  const navigate = useNavigate()

  return (
    <table className="w-full min-w-[720px] border-collapse text-sm">
      <thead className="sticky top-0 z-10 border-b">
        <tr>
          <SortHeader
            label="Name"
            active={sortKey === 'name'}
            dir={sortDir}
            onClick={() => onSort('name')}
          />
          <SortHeader
            label="Company"
            active={sortKey === 'company'}
            dir={sortDir}
            onClick={() => onSort('company')}
          />
          <th className="bg-muted px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tags
          </th>
          <SortHeader
            label="Last contact"
            active={sortKey === 'lastContact'}
            dir={sortDir}
            onClick={() => onSort('lastContact')}
          />
          <SortHeader
            label="Date met"
            active={sortKey === 'dateMet'}
            dir={sortDir}
            onClick={() => onSort('dateMet')}
          />
          <th className="w-10 bg-muted px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {contacts.map((c) => {
            const tags = c.tagIds
              .map((id) => tagMap.get(id))
              .filter(Boolean) as Tag[]
            return (
              <tr
                key={c.id}
                onClick={() => navigate(ROUTES.contact(c.id))}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <ContactAvatar contact={c} className="h-8 w-8 text-xs" />
                    <div className="flex flex-col">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {fullName(c)}
                        {c.connectionType && (
                          <span
                            className="text-xs"
                            title={CONNECTION_TYPES[c.connectionType].label}
                          >
                            {CONNECTION_TYPES[c.connectionType].emoji}
                          </span>
                        )}
                      </span>
                      {c.jobTitle && (
                        <span className="text-xs text-muted-foreground">
                          {c.jobTitle}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {c.company || '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 3).map((t) => (
                      <TagBadge key={t.id} tag={t} />
                    ))}
                    {tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {c.lastContactDate ? formatRelative(c.lastContactDate) : 'Never'}
                    </span>
                    <ReconnectBadge contact={c} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {formatDate(c.dateMet)}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(ROUTES.contact(c.id))}
                      >
                        View profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(c)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(c)}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            )
          })}
      </tbody>
    </table>
  )
}
