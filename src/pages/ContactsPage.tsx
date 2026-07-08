import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Search, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { ContactCard } from '@/components/contacts/ContactCard'
import { FilterPanel } from '@/components/contacts/FilterPanel'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useContacts, useTagMap, useTags } from '@/hooks/useData'
import { useUI } from '@/context/ui-context'
import { contactRepo } from '@/services'
import {
  applyFilters,
  EMPTY_FILTERS,
  sortContacts,
  type ContactFilters,
  type SortDir,
  type SortKey,
} from '@/lib/filters'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'
import { toast } from 'sonner'

type ViewMode = 'table' | 'grid'
const VIEW_KEY = 'retrn-view'

export function ContactsPage() {
  const contacts = useContacts()
  const tags = useTags() ?? []
  const tagMap = useTagMap()
  const { openNewContact } = useUI()
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = React.useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = React.useState<ContactFilters>(() => ({
    ...EMPTY_FILTERS,
    overdueOnly: searchParams.get('overdue') === '1',
  }))
  const [sortKey, setSortKey] = React.useState<SortKey>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [view, setView] = React.useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) ?? 'table',
  )
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [deleting, setDeleting] = React.useState<Contact | null>(null)

  React.useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  // Keep the URL ?q in sync so the command palette can deep-link a query.
  React.useEffect(() => {
    const urlQ = searchParams.get('q') ?? ''
    if (urlQ !== query) setQuery(urlQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function updateQuery(next: string) {
    setQuery(next)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('q', next)
    else params.delete('q')
    setSearchParams(params, { replace: true })
  }

  const fuse = React.useMemo(
    () => buildSearchIndex(contacts ?? [], tagMap),
    [contacts, tagMap],
  )

  const visible = React.useMemo(() => {
    if (!contacts) return []
    const base = query.trim() ? searchContacts(fuse, query) : contacts
    const filtered = applyFilters(base, filters)
    // Search already ranks by relevance; only re-sort when not searching.
    return query.trim()
      ? filtered
      : sortContacts(filtered, sortKey, sortDir)
  }, [contacts, query, fuse, filters, sortKey, sortDir])

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'lastContact' || key === 'dateMet' ? 'desc' : 'asc')
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const name = fullName(deleting)
    await contactRepo.remove(deleting.id)
    toast.success(`Deleted ${name}`)
  }

  const loading = contacts === undefined
  const totalCount = contacts?.length ?? 0

  return (
    <PageShell
      scrollBody={false}
      header={
        <div className="space-y-3">
          <PageHeader
            title="Contacts"
            description={
              loading
                ? 'Loading your network…'
                : `${totalCount} ${totalCount === 1 ? 'person' : 'people'} in your network`
            }
          >
            <Button onClick={openNewContact} className="gap-2">
              <Users className="h-4 w-4" />
              New contact
            </Button>
          </PageHeader>

          {/* Toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder="Search name, company, notes, where you met…"
                className="pl-9"
              />
              {query && (
                <button
                  onClick={() => updateQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <FilterPanel
                contacts={contacts ?? []}
                tags={tags}
                filters={filters}
                onChange={setFilters}
              />
              <div className="flex overflow-hidden rounded-md border">
                <button
                  onClick={() => setView('table')}
                  className={cn(
                    'flex h-8 w-9 items-center justify-center transition-colors',
                    view === 'table'
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                  aria-label="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView('grid')}
                  className={cn(
                    'flex h-8 w-9 items-center justify-center border-l transition-colors',
                    view === 'grid'
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* This is the ONLY scrollable region on this page — the header and
          toolbar above never move. */}
      {loading ? (
        <ContactsSkeleton view={view} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add the people you meet — a name and how you met is enough to start."
          action={<Button onClick={openNewContact}>Add your first contact</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="No contacts match your search and filters. Try loosening them."
          action={
            <Button
              variant="outline"
              onClick={() => {
                updateQuery('')
                setFilters(EMPTY_FILTERS)
              }}
            >
              Clear search &amp; filters
            </Button>
          }
        />
      ) : view === 'table' ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border">
          <div className="h-full overflow-auto scrollbar-thin">
            <ContactsTable
              contacts={visible}
              tagMap={tagMap}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                tagMap={tagMap}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit dialog (separate instance from the global "new" dialog) */}
      <ContactFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        contact={editing}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? fullName(deleting) : 'contact'}?`}
        description="This permanently removes the contact and their interaction history. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}

function ContactsSkeleton({ view }: { view: ViewMode }) {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
