import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, MoreHorizontal } from 'lucide-react'
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
import { FREQUENCY_OPTIONS } from '@/lib/constants'
import { fullName, formatDateShort, formatRelativeShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { markCaughtUp } from '@/lib/caughtUp'
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

const TH = 'sticky top-0 z-10 h-8 bg-bg-sunken px-3 text-left align-middle text-xs font-medium text-muted-foreground'

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  return (
    <th
      className={cn(TH, className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex h-full items-center gap-1 rounded-sm transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          active && 'text-foreground',
        )}
      >
        {label}
        {active &&
          (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  )
}

/**
 * The contacts table: 36px rows, a sticky 32px header, hairlines only. Six
 * columns that answer who / where / how tagged / how long / how often / met.
 */
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
    <table className="w-full min-w-[840px] border-collapse text-sm">
      <thead>
        <tr className="[&>th]:border-b">
          <SortHeader label="Name" sortKey="name" active={sortKey === 'name'} dir={sortDir} onSort={onSort} className="w-[28%]" />
          <SortHeader label="Company" sortKey="company" active={sortKey === 'company'} dir={sortDir} onSort={onSort} className="w-[18%]" />
          <th className={TH}>Tags</th>
          <SortHeader label="Last contact" sortKey="lastContact" active={sortKey === 'lastContact'} dir={sortDir} onSort={onSort} className="w-[14%]" />
          <th className={cn(TH, 'w-[10%]')}>Cadence</th>
          <SortHeader label="Met" sortKey="dateMet" active={sortKey === 'dateMet'} dir={sortDir} onSort={onSort} className="w-[10%]" />
          <th className={cn(TH, 'w-10')} aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {contacts.map((c) => {
          const tags = c.tagIds.map((id) => tagMap.get(id)).filter(Boolean) as Tag[]
          const cadence = FREQUENCY_OPTIONS[c.contactFrequencyGoal]
          return (
            <tr
              key={c.id}
              onClick={() => navigate(ROUTES.contact(c.id))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(ROUTES.contact(c.id))
              }}
              tabIndex={0}
              className="group h-9 cursor-pointer border-b transition-colors duration-fast last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none"
            >
              <td className="px-3 py-0">
                <div className="flex items-center gap-2.5">
                  <ContactAvatar contact={c} className="h-5 w-5" />
                  <span className="truncate font-medium">{fullName(c)}</span>
                  {c.jobTitle && (
                    <span className="hidden truncate text-muted-foreground xl:inline">
                      {c.jobTitle}
                    </span>
                  )}
                </div>
              </td>
              <td className="truncate px-3 py-0 text-text-secondary">{c.company || '—'}</td>
              <td className="px-3 py-0">
                <div className="flex items-center gap-1 overflow-hidden">
                  {tags.slice(0, 3).map((t) => (
                    <TagBadge key={t.id} tag={t} />
                  ))}
                  {tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-0">
                <div className="flex items-center gap-2">
                  <time className="tnum text-text-secondary">
                    {c.lastContactDate ? formatRelativeShort(c.lastContactDate) : '—'}
                  </time>
                  <ReconnectBadge contact={c} />
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-0 text-text-secondary">{cadence.short}</td>
              <td className="tnum whitespace-nowrap px-3 py-0 text-text-secondary">
                {formatDateShort(c.dateMet)}
              </td>
              <td className="px-1 py-0 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${fullName(c)}`}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(ROUTES.contact(c.id))}>
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(c)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void markCaughtUp(c)}>
                      Caught up today
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(c)}
                      className="text-danger focus:text-danger"
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
