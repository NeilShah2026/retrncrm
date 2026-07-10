import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  Coffee,
  GraduationCap,
  Link2,
  Mail,
  MapPin,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Phone,
  Repeat,
  Send,
  Sparkles,
  Trash2,
  Globe,
  AtSign,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { TagBadge } from '@/components/common/TagBadge'
import { StrengthMeter } from '@/components/common/StrengthMeter'
import { ReconnectBadge } from '@/components/common/ReconnectBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { PageShell } from '@/components/layout/PageShell'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { LogInteractionDialog } from '@/components/contacts/LogInteractionDialog'
import { CoffeeChatPrepDialog } from '@/components/contacts/CoffeeChatPrepDialog'
import { ComposeDialog } from '@/components/templates/ComposeDialog'
import { useContact, useContactMap, useTagMap } from '@/hooks/useData'
import { contactRepo } from '@/services'
import {
  CONNECTION_TYPES,
  FREQUENCY_OPTIONS,
  INTERACTION_TYPES,
  MEET_SOURCES,
  STRENGTH_LABELS,
} from '@/lib/constants'
import { getReconnectStatus } from '@/lib/reconnect'
import {
  fullName,
  formatDate,
  formatRelative,
  renderMarkdown,
} from '@/lib/format'
import type { Contact, Interaction, Tag } from '@/types'
import { ROUTES } from '@/lib/routes'
import { toast } from 'sonner'

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const contact = useContact(id)
  const tagMap = useTagMap()
  const contactMap = useContactMap()
  const navigate = useNavigate()

  const [editing, setEditing] = React.useState(false)
  const [logging, setLogging] = React.useState(false)
  const [editingInteraction, setEditingInteraction] =
    React.useState<Interaction | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [deletingInteraction, setDeletingInteraction] =
    React.useState<Interaction | null>(null)
  const [prepping, setPrepping] = React.useState(false)
  const [composing, setComposing] = React.useState(false)

  if (contact === undefined) return <DetailSkeleton />

  if (contact === null) {
    return (
      <PageShell header={<PageHeaderBar />}>
        <EmptyState
          icon={UserX}
          title="Contact not found"
          description="This contact may have been deleted."
          action={
            <Button asChild>
              <Link to={ROUTES.contacts}>Back to contacts</Link>
            </Button>
          }
        />
      </PageShell>
    )
  }

  // `contact` is narrowed to Contact past the guards above; capture it so the
  // async handlers below don't lose the narrowing inside their closures.
  const current: Contact = contact
  const tags = contact.tagIds
    .map((tid) => tagMap.get(tid))
    .filter(Boolean) as Tag[]
  const status = getReconnectStatus(contact)
  const notesHtml = renderMarkdown(contact.notes)
  const sortedInteractions = [...contact.interactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
  const introducer = contact.introducedById
    ? contactMap.get(contact.introducedById)
    : undefined

  async function handleDelete() {
    const name = fullName(current)
    await contactRepo.remove(current.id)
    toast.success(`Deleted ${name}`)
    navigate(ROUTES.contacts)
  }

  async function handleDeleteInteraction() {
    if (!deletingInteraction) return
    await contactRepo.removeInteraction(current.id, deletingInteraction.id)
    toast.success('Interaction removed')
  }

  return (
    <PageShell
      header={
        <PageHeaderBar
          contact={contact}
          onPrep={() => setPrepping(true)}
          onLog={() => setLogging(true)}
          onCompose={() => setComposing(true)}
          onEdit={() => setEditing(true)}
          onDelete={() => setDeleting(true)}
        />
      }
    >
      {/* Profile hero — the big avatar/tags/strength block scrolls with the
          rest of the content; only the slim bar above is pinned. */}
      <div className="mb-6 flex items-start gap-4">
        <ContactAvatar
          contact={contact}
          className="h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl"
        />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">
            {fullName(contact)}
          </h2>
          {(contact.jobTitle || contact.company) && (
            <p className="mt-0.5 text-muted-foreground">
              {[contact.jobTitle, contact.company]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <TagBadge key={t.id} tag={t} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <StrengthMeter
              value={contact.relationshipStrength}
              showLabel
              size="md"
            />
            <ReconnectBadge contact={contact} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {contact.howWeMet && (
            <Card>
              <CardContent className="p-5">
                <SectionLabel>How we met</SectionLabel>
                <p className="text-sm leading-relaxed">{contact.howWeMet}</p>
                {(contact.whereWeMet || contact.dateMet) && (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {contact.whereWeMet && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {contact.whereWeMet}
                      </span>
                    )}
                    {contact.dateMet && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(contact.dateMet)}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {notesHtml && (
            <Card>
              <CardContent className="p-5">
                <SectionLabel>Notes</SectionLabel>
                <div
                  className="prose-notes"
                  dangerouslySetInnerHTML={{ __html: notesHtml }}
                />
              </CardContent>
            </Card>
          )}

          {/* Interaction timeline */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel className="mb-0">
                  Timeline
                  <span className="ml-2 font-normal text-muted-foreground">
                    {sortedInteractions.length}
                  </span>
                </SectionLabel>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLogging(true)}
                  className="gap-1.5"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {sortedInteractions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No interactions logged yet.
                </p>
              ) : (
                <ol className="relative space-y-4 border-l pl-6">
                  {sortedInteractions.map((it) => (
                    <li key={it.id} className="group relative">
                      <span className="absolute -left-[1.85rem] flex h-7 w-7 items-center justify-center rounded-full border bg-background text-sm">
                        {INTERACTION_TYPES[it.type]?.emoji ?? '•'}
                      </span>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {INTERACTION_TYPES[it.type]?.label ?? 'Note'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(it.date)}
                            </span>
                          </div>
                          {it.summary && (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {it.summary}
                            </p>
                          )}
                        </div>
                        <div className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingInteraction(it)
                                  setLogging(true)
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeletingInteraction(it)}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionLabel>Contact</SectionLabel>
              <div className="space-y-3 text-sm">
                <ContactChannel
                  icon={Mail}
                  href={contact.email ? `mailto:${contact.email}` : undefined}
                  value={contact.email}
                  label="Email"
                />
                <ContactChannel
                  icon={Phone}
                  href={contact.phone ? `tel:${contact.phone}` : undefined}
                  value={contact.phone}
                  label="Phone"
                />
                <ContactChannel
                  icon={Globe}
                  href={contact.linkedinUrl}
                  value={contact.linkedinUrl ? 'LinkedIn profile' : undefined}
                  label="LinkedIn"
                  external
                />
                <ContactChannel
                  icon={AtSign}
                  href={contact.twitter}
                  value={contact.twitter ? 'Twitter / X' : undefined}
                  label="Twitter"
                  external
                />
                {contact.otherLinks.map((l) => (
                  <ContactChannel
                    key={l.id}
                    icon={Link2}
                    href={l.url}
                    value={l.label || l.url}
                    label="Link"
                    external
                  />
                ))}
                {!hasAnyChannel(contact) && (
                  <p className="text-xs text-muted-foreground">
                    No contact details yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {hasBackgroundInfo(contact) && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <SectionLabel>Background</SectionLabel>
                {contact.connectionType && (
                  <InfoRow
                    icon={Sparkles}
                    label="Relationship"
                    value={`${CONNECTION_TYPES[contact.connectionType].emoji} ${CONNECTION_TYPES[contact.connectionType].label}`}
                  />
                )}
                {contact.source && (
                  <InfoRow
                    icon={MapPin}
                    label="How you met"
                    value={`${MEET_SOURCES[contact.source].emoji} ${MEET_SOURCES[contact.source].label}`}
                  />
                )}
                {contact.school && (
                  <InfoRow icon={GraduationCap} label="School" value={contact.school} />
                )}
                {(contact.major || contact.gradYear) && (
                  <InfoRow
                    icon={GraduationCap}
                    label="Program"
                    value={[contact.major, contact.gradYear && `'${contact.gradYear.slice(-2)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                )}
                {contact.introducedById && introducer && (
                  <InfoRow
                    icon={Sparkles}
                    label="Introduced by"
                    value=""
                    valueNode={
                      <Link
                        to={ROUTES.contact(introducer.id)}
                        className="font-medium text-indigo-500 hover:underline"
                      >
                        {fullName(introducer)}
                      </Link>
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-4 p-5">
              <SectionLabel>Relationship</SectionLabel>
              <InfoRow
                icon={Clock}
                label="Last contact"
                value={
                  contact.lastContactDate
                    ? `${formatDate(contact.lastContactDate)} · ${formatRelative(contact.lastContactDate)}`
                    : 'Never'
                }
              />
              <InfoRow
                icon={Repeat}
                label="Cadence goal"
                value={FREQUENCY_OPTIONS[contact.contactFrequencyGoal].label}
              />
              <InfoRow
                icon={
                  status.overdue ? Clock : CalendarDays
                }
                label="Status"
                value={status.reason}
                valueClass={status.overdue ? 'text-destructive' : undefined}
              />
              <Separator />
              <InfoRow
                icon={Building2}
                label="Industry"
                value={contact.industry || '—'}
              />
              <InfoRow
                icon={CalendarDays}
                label="Added"
                value={formatDate(contact.createdAt.slice(0, 10))}
              />
              <div className="pt-1 text-xs text-muted-foreground">
                Strength: {STRENGTH_LABELS[contact.relationshipStrength]}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ContactFormDialog
        open={editing}
        onOpenChange={setEditing}
        contact={contact}
      />
      <LogInteractionDialog
        open={logging}
        onOpenChange={(o) => {
          setLogging(o)
          if (!o) setEditingInteraction(null)
        }}
        contactId={contact.id}
        interaction={editingInteraction}
      />
      <CoffeeChatPrepDialog
        open={prepping}
        onOpenChange={setPrepping}
        contactId={contact.id}
        onCompose={() => {
          setPrepping(false)
          setComposing(true)
        }}
        onLogInteraction={() => {
          setPrepping(false)
          setLogging(true)
        }}
      />
      <ComposeDialog
        open={composing}
        onOpenChange={setComposing}
        contactId={contact.id}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${fullName(contact)}?`}
        description="This permanently removes the contact and their interaction history."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={Boolean(deletingInteraction)}
        onOpenChange={(o) => !o && setDeletingInteraction(null)}
        title="Delete this interaction?"
        description="The last-contact date will be recalculated from remaining interactions."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteInteraction}
      />
    </PageShell>
  )
}

/**
 * The pinned bar for this page — back button, a compact identity, and the
 * primary actions. Kept slim on purpose: the full avatar/tags/strength "hero"
 * lives in the scrollable body below it, not here.
 */
function PageHeaderBar({
  contact,
  onPrep,
  onLog,
  onCompose,
  onEdit,
  onDelete,
}: {
  contact?: Contact
  onPrep?: () => void
  onLog?: () => void
  onCompose?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {contact && (
          <ContactAvatar contact={contact} className="h-7 w-7 shrink-0 text-[10px]" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">
            {contact ? fullName(contact) : 'Contact'}
          </h1>
          {contact && (contact.jobTitle || contact.company) && (
            <p className="truncate text-xs text-muted-foreground">
              {[contact.jobTitle, contact.company].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {contact && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrep}
            className="hidden gap-1.5 sm:inline-flex"
          >
            <Coffee className="h-4 w-4" />
            Prep
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onPrep}
            aria-label="Prep"
            className="sm:hidden"
          >
            <Coffee className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onLog} className="hidden gap-1.5 sm:inline-flex">
            <MessageSquarePlus className="h-4 w-4" />
            Log interaction
          </Button>
          <Button
            size="icon-sm"
            onClick={onLog}
            aria-label="Log interaction"
            className="sm:hidden"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCompose}>
                <Send className="h-4 w-4" /> Send a message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Edit contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

function hasAnyChannel(c: Contact): boolean {
  return Boolean(
    c.email || c.phone || c.linkedinUrl || c.twitter || c.otherLinks.length,
  )
}

function hasBackgroundInfo(c: Contact): boolean {
  return Boolean(
    c.connectionType || c.source || c.school || c.major || c.gradYear || c.introducedById,
  )
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2
      className={`mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ''}`}
    >
      {children}
    </h2>
  )
}

function ContactChannel({
  icon: Icon,
  href,
  value,
  label,
  external,
}: {
  icon: typeof Mail
  href?: string
  value?: string
  label: string
  external?: boolean
}) {
  if (!value) return null
  const content = (
    <span className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </span>
  )
  if (!href) return <div>{content}</div>
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="block truncate text-foreground transition-colors hover:text-indigo-500"
      aria-label={label}
    >
      {content}
    </a>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass,
  valueNode,
}: {
  icon: typeof Mail
  label: string
  value: string
  valueClass?: string
  valueNode?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={`text-right ${valueClass ?? ''}`}>
        {valueNode ?? value}
      </span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <PageShell header={<PageHeaderBar />}>
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </PageShell>
  )
}
