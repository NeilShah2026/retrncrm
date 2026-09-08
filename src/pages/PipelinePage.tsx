import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  KanbanSquare,
  Plus,
  CalendarClock,
  ExternalLink,
  MoreHorizontal,
  MapPin,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { OpportunityFormDialog } from '@/components/pipeline/OpportunityFormDialog'
import { useContactMap, useOpportunities } from '@/hooks/useData'
import { opportunityRepo } from '@/services'
import {
  OPPORTUNITY_OUTCOMES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_KEYS,
  OPPORTUNITY_TYPES,
} from '@/lib/constants'
import { daysSince, formatDateShort, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact, Opportunity, OpportunityStage } from '@/types'
import { toast } from 'sonner'

function deadlineChip(deadline?: string) {
  if (!deadline) return null
  const days = daysSince(deadline)
  if (days === null) return null
  const overdue = days > 0
  const soon = days <= 0 && days > -7
  return {
    overdue,
    soon,
    label: overdue
      ? `Past due ${formatDateShort(deadline)}`
      : days === 0
        ? 'Due today'
        : `Due ${formatDateShort(deadline)}`,
  }
}

export function PipelinePage() {
  const opportunities = useOpportunities()
  const contactMap = useContactMap()
  const [searchParams, setSearchParams] = useSearchParams()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Opportunity | null>(null)
  const [addStage, setAddStage] = React.useState<OpportunityStage | undefined>()
  const [deleting, setDeleting] = React.useState<Opportunity | null>(null)
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = React.useState<OpportunityStage | null>(null)

  // ⌘K → "New opportunity" lands here with ?new=1.
  React.useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null)
      setAddStage(undefined)
      setFormOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const byStage = React.useMemo(() => {
    const map: Record<OpportunityStage, Opportunity[]> = {
      researching: [],
      applied: [],
      interviewing: [],
      offer: [],
      closed: [],
    }
    for (const o of opportunities ?? []) map[o.stage]?.push(o)
    for (const k of OPPORTUNITY_STAGE_KEYS) {
      map[k].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    }
    return map
  }, [opportunities])

  function openNew(stage?: OpportunityStage) {
    setEditing(null)
    setAddStage(stage)
    setFormOpen(true)
  }

  function openEdit(o: Opportunity) {
    setEditing(o)
    setAddStage(undefined)
    setFormOpen(true)
  }

  async function moveOpportunity(opp: Opportunity, stage: OpportunityStage) {
    if (opp.stage === stage) return
    await opportunityRepo.update(opp.id, { stage, order: byStage[stage].length })
    toast.success(`${opp.company} → ${OPPORTUNITY_STAGES[stage].label}`)
  }

  async function moveTo(stage: OpportunityStage) {
    if (!dragId) return
    const opp = opportunities?.find((o) => o.id === dragId)
    setDragId(null)
    setDragOverStage(null)
    if (!opp) return
    await moveOpportunity(opp, stage)
  }

  async function confirmDelete() {
    if (!deleting) return
    await opportunityRepo.remove(deleting.id)
    toast.success(`Removed ${deleting.company}`)
  }

  const total = opportunities?.length ?? 0
  const open = (opportunities ?? []).filter((o) => o.stage !== 'closed').length

  return (
    <PageShell
      width="wide"
      scrollBody={false}
      mobile={{
        title: 'Pipeline',
        largeTitle: false,
        trailing: (
          <BarButton onClick={() => openNew()} aria-label="New opportunity">
            <Plus strokeWidth={2.4} />
          </BarButton>
        ),
      }}
      header={
        <PageHeader
          title="Pipeline"
          description={
            opportunities === undefined
              ? 'The internships and jobs you’re pursuing.'
              : `${open} open · ${total} total`
          }
        >
          <Button onClick={() => openNew()}>
            <Plus />
            New opportunity
          </Button>
        </PageHeader>
      }
    >
      <NetworkGate
        data={opportunities}
        table="opportunities"
        skeleton={<BoardSkeleton />}
        empty={
          <EmptyState
            variant="first-run"
            icon={KanbanSquare}
            title="No opportunities yet"
            description="Track the internships and jobs you’re pursuing, and link the recruiters and referrers who can help."
            action={
              <Button onClick={() => openNew()}>
                <Plus />
                Add an opportunity
              </Button>
            }
          />
        }
      >
        {() => (
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-thin sm:snap-none">
            {OPPORTUNITY_STAGE_KEYS.map((stage) => {
              const cards = byStage[stage]
              const s = OPPORTUNITY_STAGES[stage]
              return (
                <section
                  key={stage}
                  aria-label={s.label}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverStage(stage)
                  }}
                  onDragLeave={() => setDragOverStage((c) => (c === stage ? null : c))}
                  onDrop={() => void moveTo(stage)}
                  className={cn(
                    'flex w-[82vw] max-w-[280px] shrink-0 snap-start flex-col rounded-lg border bg-bg-sunken/40 transition-colors duration-fast',
                    'sm:w-[240px] xl:w-auto xl:min-w-[176px] xl:flex-1',
                    dragOverStage === stage && 'border-brand bg-brand/5',
                  )}
                >
                  <header className="flex h-9 shrink-0 items-center justify-between border-b px-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="tnum text-xs text-muted-foreground">{cards.length}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openNew(stage)}
                      aria-label={`Add to ${s.label}`}
                      className="text-muted-foreground"
                    >
                      <Plus />
                    </Button>
                  </header>

                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5 scrollbar-thin">
                    {cards.map((o) => (
                      <OpportunityCard
                        key={o.id}
                        opportunity={o}
                        contactMap={contactMap}
                        dragging={dragId === o.id}
                        onDragStart={() => setDragId(o.id)}
                        onDragEnd={() => {
                          setDragId(null)
                          setDragOverStage(null)
                        }}
                        onEdit={() => openEdit(o)}
                        onDelete={() => setDeleting(o)}
                        onMove={(st) => void moveOpportunity(o, st)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <button
                        onClick={() => openNew(stage)}
                        className="flex h-16 w-full items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition-colors duration-fast hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add opportunity
                      </button>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </NetworkGate>

      <OpportunityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        opportunity={editing}
        defaultStage={addStage}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.company ?? ''}?`}
        description="This removes the opportunity from your pipeline. Linked contacts are kept."
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}

/** One opportunity: company, role, type; then the deadline and who can help. */
function OpportunityCard({
  opportunity: o,
  contactMap,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onMove,
}: {
  opportunity: Opportunity
  contactMap: Map<string, Contact>
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onEdit: () => void
  onDelete: () => void
  onMove: (stage: OpportunityStage) => void
}) {
  const deadline = deadlineChip(o.deadline)
  const contacts = o.contactIds.map((id) => contactMap.get(id)).filter(Boolean) as Contact[]
  const outcome = o.outcome ? OPPORTUNITY_OUTCOMES[o.outcome] : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEdit()
      }}
      tabIndex={0}
      role="button"
      className={cn(
        'group cursor-pointer rounded-md border bg-card p-2.5 transition-colors duration-fast hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{o.company}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.role}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${o.company}`}
                className="-mr-1 -mt-1 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              {o.link && (
                <DropdownMenuItem asChild>
                  <a href={o.link} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open posting
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {OPPORTUNITY_STAGE_KEYS.filter((s) => s !== o.stage).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', OPPORTUNITY_STAGES[s].dot)} />
                  {OPPORTUNITY_STAGES[s].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger">
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{OPPORTUNITY_TYPES[o.type]}</span>
        {o.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {o.location}
          </span>
        )}
        {outcome && (
          <Badge variant={outcome.variant} className="ml-auto">
            {outcome.label.replace(' 🎉', '')}
          </Badge>
        )}
      </div>

      {(deadline || contacts.length > 0) && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
          {deadline ? (
            <span
              className={cn(
                'tnum inline-flex items-center gap-1 text-xs',
                deadline.overdue
                  ? 'text-danger'
                  : deadline.soon
                    ? 'text-warning'
                    : 'text-muted-foreground',
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {deadline.label}
            </span>
          ) : (
            <span />
          )}
          {contacts.length > 0 && (
            <span className="flex items-center -space-x-1" title={contacts.map(fullName).join(', ')}>
              {contacts.slice(0, 3).map((c) => (
                <ContactAvatar key={c.id} contact={c} className="h-5 w-5 ring-2 ring-card" />
              ))}
              {contacts.length > 3 && (
                <span className="pl-2 text-xs text-muted-foreground">+{contacts.length - 3}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden" aria-busy="true">
      {OPPORTUNITY_STAGE_KEYS.map((k) => (
        <div key={k} className="w-[240px] shrink-0 rounded-lg border bg-bg-sunken/40 xl:w-auto xl:flex-1">
          <div className="flex h-9 items-center border-b px-2.5">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-1.5 p-1.5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
