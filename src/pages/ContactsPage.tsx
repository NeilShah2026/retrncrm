import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardPaste,
  LayoutGrid,
  List,
  PenLine,
  Plus,
  Search,
  Tags,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton, SkeletonRow } from '@/components/ui/skeleton'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { ContactCard } from '@/components/contacts/ContactCard'
import { ContactListRow } from '@/components/contacts/ContactListRow'
import { FilterPanel } from '@/components/contacts/FilterPanel'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { AutoTagDialog } from '@/components/contacts/AutoTagDialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useContacts, useTagMap, useTags } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useUI } from '@/context/ui-context'
import { contactRepo } from '@/services'
import {
  applyFilters,
  countActiveFilters,
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

function readView(): ViewMode {
  try {
    return (localStorage.getItem(VIEW_KEY) as ViewMode) || 'table'
  } catch {
    return 'table'
  }
}

export function ContactsPage() {
  const contacts = useContacts()
  const tags = useTags() ?? []
  const tagMap = useTagMap()
  const { openNewContact, openVoiceCapture } = useUI()
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = React.useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = React.useState<ContactFilters>(() => ({
    ...EMPTY_FILTERS,
    overdueOnly: searchParams.get('overdue') === '1',
  }))
  const [sortKey, setSortKey] = React.useState<SortKey>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [view, setView] = React.useState<ViewMode>(readView)
  const isMobile = useIsMobile()
  const effectiveView: ViewMode = isMobile ? 'grid' : view
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [deleting, setDeleting] = React.useState<Contact | null>(null)
  const [autoTagOpen, setAutoTagOpen] = React.useState(false)

  React.useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // Private mode: the choice just doesn't persist.
    }
  }, [view])

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
    return query.trim() ? filtered : sortContacts(filtered, sortKey, sortDir)
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

  const totalCount = contacts?.length ?? 0
  const activeFilters = countActiveFilters(filters)
  const narrowed = Boolean(query.trim()) || activeFilters > 0

  function clearNarrowing() {
    updateQuery('')
    setFilters(EMPTY_FILTERS)
  }

  /** Search + filters, rendered in exactly one place. */
  function renderToolbar() {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search name, company, notes…"
            aria-label="Search contacts"
            className="h-9 rounded-[10px] border-0 bg-bg-sunken pl-8 text-base md:h-8 md:rounded-md md:border md:bg-background md:text-sm"
          />
          {query && (
            <button
              onClick={() => updateQuery('')}
              className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
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
          {contacts && contacts.length > 0 && (
            <span className="tnum hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
              {narrowed ? `${visible.length} of ${totalCount}` : `${totalCount}`}
            </span>
          )}
          <div
            className="ml-auto hidden h-8 items-center rounded-md border p-0.5 md:flex"
            role="group"
            aria-label="View"
          >
            <ViewButton active={view === 'table'} onClick={() => setView('table')} label="Table view">
              <List className="h-3.5 w-3.5" />
            </ViewButton>
            <ViewButton active={view === 'grid'} onClick={() => setView('grid')} label="Grid view">
              <LayoutGrid className="h-3.5 w-3.5" />
            </ViewButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageShell
      scrollBody={false}
      width="wide"
      mobile={{
        title: 'Contacts',
        largeTitle: false,
        toolbar: isMobile ? renderToolbar() : undefined,
        trailing: (
          <>
            {totalCount > 0 && (
              <BarButton onClick={() => setAutoTagOpen(true)} aria-label="Suggest tags">
                <Tags />
              </BarButton>
            )}
            <BarButton onClick={openNewContact} aria-label="New contact">
              <Plus strokeWidth={2.4} />
            </BarButton>
          </>
        ),
      }}
      header={
        <div className="space-y-3">
          <PageHeader
            title="Contacts"
            description={
              contacts === undefined
                ? 'Everyone you’ve met, and when you last spoke.'
                : `${totalCount} ${totalCount === 1 ? 'person' : 'people'} in your network`
            }
          >
            {totalCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setAutoTagOpen(true)}
                title="Propose tags for people you haven’t tagged"
              >
                <Tags />
                Suggest tags
              </Button>
            )}
            <Button onClick={openNewContact}>
              <UserPlus />
              New contact
            </Button>
          </PageHeader>

          {!isMobile && renderToolbar()}
        </div>
      }
    >
      <NetworkGate
        data={contacts}
        table="contacts"
        skeleton={<ContactsSkeleton view={effectiveView} />}
        empty={
          <EmptyState
            variant="first-run"
            icon={Users}
            title="No contacts yet"
            description="Add the first person you met. A name and where you met is enough."
            action={
              <>
                <Button onClick={openVoiceCapture}>
                  <PenLine />
                  Say who you met
                </Button>
                <Button variant="outline" onClick={openNewContact}>
                  <UserPlus />
                  New contact
                </Button>
                <Button variant="outline" onClick={openNewContact}>
                  <ClipboardPaste />
                  Paste from LinkedIn
                </Button>
              </>
            }
          />
        }
      >
        {() =>
          visible.length === 0 ? (
            <EmptyState
              variant="no-results"
              icon={Search}
              title={
                query.trim()
                  ? `No contacts match “${query.trim()}”`
                  : 'No contacts match these filters'
              }
              description="Clear the search and filters, or add someone new."
              action={
                <>
                  <Button variant="outline" onClick={clearNarrowing}>
                    Clear search & filters
                  </Button>
                  <Button variant="ghost" onClick={openNewContact}>
                    <UserPlus />
                    Add someone
                  </Button>
                </>
              }
            />
          ) : effectiveView === 'table' ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
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
          ) : isMobile ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
              <div className="overflow-hidden rounded-lg border bg-card">
                {visible.map((c, i) => (
                  <ContactListRow
                    key={c.id}
                    contact={c}
                    tagMap={tagMap}
                    last={i === visible.length - 1}
                  />
                ))}
              </div>
              <p className="tnum px-1 pb-2 pt-3 text-center text-[13px] text-muted-foreground">
                {visible.length} {visible.length === 1 ? 'person' : 'people'}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3">
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
          )
        }
      </NetworkGate>

      <ContactFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        contact={editing}
      />

      <AutoTagDialog open={autoTagOpen} onOpenChange={setAutoTagOpen} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? fullName(deleting) : 'contact'}?`}
        description="This permanently removes the contact and their activity history. It can’t be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-full w-7 items-center justify-center rounded-sm transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ContactsSkeleton({ view }: { view: ViewMode }) {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-lg border" aria-busy="true">
      <div className="h-8 border-b bg-bg-sunken" />
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}
