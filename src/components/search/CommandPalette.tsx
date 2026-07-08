import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Tag as TagIcon,
  Settings,
  UserPlus,
  Building2,
  KanbanSquare,
  Mail,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts, useTagMap } from '@/hooks/useData'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNewContact: () => void
}

export function CommandPalette({ open, onOpenChange, onNewContact }: Props) {
  const navigate = useNavigate()
  const contacts = useContacts()
  const tagMap = useTagMap()
  const [query, setQuery] = React.useState('')

  const fuse = React.useMemo(
    () => buildSearchIndex(contacts ?? [], tagMap),
    [contacts, tagMap],
  )

  const results = React.useMemo(
    () => (query.trim() ? searchContacts(fuse, query).slice(0, 8) : []),
    [fuse, query],
  )

  // Clear the query each time the palette opens.
  React.useEffect(() => {
    if (open) setQuery('')
  }, [open])

  function run(action: () => void) {
    onOpenChange(false)
    // Defer so the dialog close animation doesn't clash with navigation.
    setTimeout(action, 0)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search people, companies, notes…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          No results for “{query}”. Try a company, tag, or where you met.
        </CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="People">
            {results.map((c) => (
              <CommandItem
                key={c.id}
                value={`person-${c.id}`}
                onSelect={() => run(() => navigate(ROUTES.contact(c.id)))}
              >
                <ContactAvatar contact={c} className="h-7 w-7 text-xs" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{fullName(c)}</span>
                  {(c.company || c.jobTitle) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {[c.jobTitle, c.company].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query.trim() && (
          <CommandGroup heading="Actions">
            <CommandItem value="new-contact" onSelect={() => run(onNewContact)}>
              <UserPlus /> New contact
            </CommandItem>
            <CommandItem
              value="go-dashboard"
              onSelect={() => run(() => navigate(ROUTES.dashboard))}
            >
              <LayoutDashboard /> Dashboard
            </CommandItem>
            <CommandItem
              value="go-contacts"
              onSelect={() => run(() => navigate(ROUTES.contacts))}
            >
              <Users /> All contacts
            </CommandItem>
            <CommandItem
              value="go-pipeline"
              onSelect={() => run(() => navigate(ROUTES.pipeline))}
            >
              <KanbanSquare /> Pipeline
            </CommandItem>
            <CommandItem
              value="go-templates"
              onSelect={() => run(() => navigate(ROUTES.templates))}
            >
              <Mail /> Templates
            </CommandItem>
            <CommandItem
              value="go-tags"
              onSelect={() => run(() => navigate(ROUTES.tags))}
            >
              <TagIcon /> Manage tags
            </CommandItem>
            <CommandItem
              value="go-settings"
              onSelect={() => run(() => navigate(ROUTES.settings))}
            >
              <Settings /> Settings &amp; data
            </CommandItem>
          </CommandGroup>
        )}

        {query.trim() && results.length > 0 && (
          <CommandGroup heading="Jump to">
            <CommandItem
              value="view-all-matches"
              onSelect={() => run(() => navigate(ROUTES.contactsSearch(query)))}
            >
              <Building2 /> See all contacts matching “{query}”
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
