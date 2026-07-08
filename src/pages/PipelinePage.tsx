import * as React from 'react'
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
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactChip } from '@/components/contacts/ContactChip'
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
import { daysSince, formatDate } from '@/lib/format'
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
      ? `Past due ${formatDate(deadline)}`
      : days === 0
        ? 'Due today'
        : `Due ${formatDate(deadline)}`,
  }
}

export function PipelinePage() {
  const opportunities = useOpportunities()
  const contactMap = useContactMap()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Opportunity | null>(null)
  const [addStage, setAddStage] = React.useState<OpportunityStage | undefined>()
  const [deleting, setDeleting] = React.useState<Opportunity | null>(null)
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dragOverStage, setDragOverStage] =
    React.useState<OpportunityStage | null>(null)

  const loading = opportunities === undefined

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

  async function moveTo(stage: OpportunityStage) {
    if (!dragId) return
    const opp = opportunities?.find((o) => o.id === dragId)
    setDragId(null)
    setDragOverStage(null)
    if (!opp || opp.stage === stage) return
    await opportunityRepo.update(opp.id, {
      stage,
      order: byStage[stage].length,
    })
    toast.success(`Moved ${opp.company} → ${OPPORTUNITY_STAGES[stage].label}`)
  }

  async function confirmDelete() {
    if (!deleting) return
    await opportunityRepo.remove(deleting.id)
    toast.success(`Removed ${deleting.company}`)
  }

  const total = opportunities?.length ?? 0

  return (
    <PageShell
      width="wide"
      scrollBody={false}
      header={
        <PageHeader
          title="Pipeline"
          description={
            loading
              ? 'Loading…'
              : `${total} ${total === 1 ? 'opportunity' : 'opportunities'} across your search`
          }
        >
          <Button onClick={() => openNew()} className="gap-2">
            <Plus className="h-4 w-4" />
            New opportunity
          </Button>
        </PageHeader>
      }
    >
      {loading ? (
        <div className="flex gap-4 overflow-x-auto">
          {OPPORTUNITY_STAGE_KEYS.map((k) => (
            <Skeleton key={k} className="h-72 w-[280px] shrink-0" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No opportunities yet"
          description="Track the internships and jobs you're pursuing, and link the recruiters and referrers who can help."
          action={
            <Button onClick={() => openNew()}>Add your first opportunity</Button>
          }
        />
      ) : (
        // The only scroll region on this page: horizontal for the columns,
        // and each column scrolls its own card list vertically below.
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {OPPORTUNITY_STAGE_KEYS.map((stage) => {
            const cards = byStage[stage]
            const s = OPPORTUNITY_STAGES[stage]
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverStage(stage)
                }}
                onDragLeave={() => setDragOverStage((c) => (c === stage ? null : c))}
                onDrop={() => void moveTo(stage)}
                className={cn(
                  'flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors',
                  dragOverStage === stage && 'ring-2 ring-ring bg-accent/40',
                )}
              >
                <div className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openNew(stage)}
                    aria-label={`Add to ${s.label}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
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
                    />
                  ))}
                  {cards.length === 0 && (
                    <button
                      onClick={() => openNew(stage)}
                      className="w-full rounded-lg border border-dashed py-6 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
                    >
                      + Add opportunity
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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

function OpportunityCard({
  opportunity: o,
  contactMap,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  opportunity: Opportunity
  contactMap: Map<string, Contact>
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const deadline = deadlineChip(o.deadline)
  const contacts = o.contactIds
    .map((id) => contactMap.get(id))
    .filter(Boolean) as Contact[]
  const outcome = o.outcome ? OPPORTUNITY_OUTCOMES[o.outcome] : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={cn(
        'group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-foreground/20 hover:shadow',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{o.company}</p>
          <p className="truncate text-xs text-muted-foreground">{o.role}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              {o.link && (
                <DropdownMenuItem asChild>
                  <a href={o.link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open posting
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">
          {OPPORTUNITY_TYPES[o.type]}
        </Badge>
        {outcome && (
          <Badge variant={outcome.variant} className="text-[10px]">
            {outcome.label}
          </Badge>
        )}
        {o.location && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {o.location}
          </span>
        )}
      </div>

      {deadline && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-[11px]',
            deadline.overdue
              ? 'text-destructive'
              : deadline.soon
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
          )}
        >
          <CalendarClock className="h-3 w-3" />
          {deadline.label}
        </div>
      )}

      {contacts.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {contacts.map((c) => (
            <ContactChip key={c.id} contact={c} asLink />
          ))}
        </div>
      )}
    </div>
  )
}
