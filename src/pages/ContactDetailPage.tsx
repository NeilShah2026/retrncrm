import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Coffee,
  GraduationCap,
  Link2,
  Mail,
  MapPin,
  Merge,
  MoreHorizontal,
  Pencil,
  Phone,
  Repeat,
  Send,
  Trash2,
  Plus,
  AlarmClockPlus,
  Globe,
  AtSign,
  UserX,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, PanelSection } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format, parseISO } from 'date-fns'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { TagBadge } from '@/components/common/TagBadge'
import { StrengthMeter } from '@/components/common/StrengthMeter'
import { ReconnectBadge } from '@/components/common/ReconnectBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { PageShell } from '@/components/layout/PageShell'
import { BackBarButton, BarButton } from '@/components/layout/MobileNavBar'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ContactFormDialog, type ContactField } from '@/components/contacts/ContactFormDialog'
import { MergeContactDialog } from '@/components/contacts/MergeContactDialog'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { CoffeeChatPrepDialog } from '@/components/contacts/CoffeeChatPrepDialog'
import { ComposeDialog } from '@/components/templates/ComposeDialog'
import {
  DesktopFollowUps,
  DesktopKeyDates,
  PhoneContactReminders,
  type ReminderSheets,
} from '@/components/reminders/ContactReminders'
import { InsetGroup, InsetRow } from '@/components/ui/inset-list'
import { useContact, useContactMap, useEvents, useTagMap } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { contactRepo } from '@/services'
import {
  CONNECTION_TYPES,
  FREQUENCY_OPTIONS,
  INTERACTION_TYPES,
  MEET_SOURCES,
  STRENGTH_LABELS,
} from '@/lib/constants'
import { CONNECTION_ICONS, INTERACTION_ICONS, SOURCE_ICONS } from '@/lib/icons'
import { getReconnectStatus } from '@/lib/reconnect'
import { markCaughtUp } from '@/lib/caughtUp'
import { fullName, formatDate, formatRelative, renderMarkdown } from '@/lib/format'
import type { Contact, Interaction, Tag } from '@/types'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const contact = useContact(id)

  return (
    <NetworkGate
      data={contact === undefined ? undefined : [contact]}
      table="contacts"
      isEmpty={(d) => d[0] === null}
      skeleton={<DetailSkeleton />}
      empty={
        <PageShell
          mobile={{ title: 'Contact', largeTitle: false, leading: <BackBarButton label="Contacts" /> }}
          header={<PageHeaderBar />}
        >
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
      }
    >
      {([c]) => <ContactDetail contact={c as Contact} />}
    </NetworkGate>
  )
}

function ContactDetail({ contact }: { contact: Contact }) {
  const tagMap = useTagMap()
  const contactMap = useContactMap()
  const events = useEvents()
  const navigate = useNavigate()

  const isMobile = useIsMobile()
  const [editing, setEditing] = React.useState(false)
  const [editField, setEditField] = React.useState<ContactField | undefined>(undefined)

  /** Open the edit sheet, optionally straight onto one field. */
  function edit(field?: ContactField) {
    setEditField(field)
    setEditing(true)
  }
  const [merging, setMerging] = React.useState(false)
  const [scheduling, setScheduling] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deletingInteraction, setDeletingInteraction] = React.useState<Interaction | null>(null)
  const [prepping, setPrepping] = React.useState(false)
  const [composing, setComposing] = React.useState(false)
  const followUpsRef = React.useRef<ReminderSheets>(null)

  const tags = contact.tagIds.map((tid) => tagMap.get(tid)).filter(Boolean) as Tag[]
  const status = getReconnectStatus(contact)
  const notesHtml = renderMarkdown(contact.notes)
  const sortedInteractions = [...contact.interactions].sort((a, b) => b.date.localeCompare(a.date))
  const introducer = contact.introducedById ? contactMap.get(contact.introducedById) : undefined
  const nowIso = new Date().toISOString()
  const upcomingMeetings = (events ?? []).filter(
    (e) => e.contactIds.includes(contact.id) && e.endsAt >= nowIso,
  )

  async function handleDelete() {
    const name = fullName(contact)
    await contactRepo.remove(contact.id)
    toast.success(`Deleted ${name}`)
    navigate(ROUTES.contacts)
  }

  async function handleDeleteInteraction() {
    if (!deletingInteraction) return
    await contactRepo.removeInteraction(contact.id, deletingInteraction.id)
    toast.success('Activity removed')
  }

  const ConnectionIcon = contact.connectionType ? CONNECTION_ICONS[contact.connectionType] : Users

  /**
   * The phone's contact card, in the shape Contacts.app gives one: who they
   * are, the four things you do most as buttons, then grouped rows. Every row
   * of saved detail opens the edit sheet, and anything missing has an "Add…"
   * row that opens it straight onto that field — so filling someone in is one
   * tap from where the gap is, rather than a hunt through a long form.
   */
  function renderPhone() {
    const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' · ')
    const channels: {
      key: string
      label: string
      value: string
      href: string
      external?: boolean
    }[] = []
    if (contact.email) {
      channels.push({ key: 'email', label: 'Email', value: contact.email, href: `mailto:${contact.email}` })
    }
    if (contact.phone) {
      channels.push({ key: 'phone', label: 'Phone', value: contact.phone, href: `tel:${contact.phone}` })
    }
    if (contact.linkedinUrl) {
      channels.push({ key: 'li', label: 'LinkedIn', value: 'View profile', href: contact.linkedinUrl, external: true })
    }
    if (contact.twitter) {
      channels.push({ key: 'x', label: 'X', value: 'View profile', href: contact.twitter, external: true })
    }
    for (const l of contact.otherLinks) {
      channels.push({ key: l.id, label: l.label || 'Link', value: l.url, href: l.url, external: true })
    }

    const missing: { field: ContactField; label: string }[] = []
    if (!contact.email) missing.push({ field: 'email', label: 'Add Email' })
    if (!contact.phone) missing.push({ field: 'phone', label: 'Add Phone' })
    if (!contact.linkedinUrl) missing.push({ field: 'linkedinUrl', label: 'Add LinkedIn' })

    const background: { label: string; value: React.ReactNode }[] = []
    if (contact.connectionType) {
      background.push({ label: 'Relationship', value: CONNECTION_TYPES[contact.connectionType].label })
    }
    if (contact.source) background.push({ label: 'How you met', value: MEET_SOURCES[contact.source].label })
    if (contact.school) background.push({ label: 'School', value: contact.school })
    if (contact.major || contact.gradYear) {
      background.push({
        label: 'Program',
        value: [contact.major, contact.gradYear && `’${contact.gradYear.slice(-2)}`]
          .filter(Boolean)
          .join(' · '),
      })
    }
    if (contact.industry) background.push({ label: 'Industry', value: contact.industry })

    return (
      <div className="space-y-6 pb-2">
        <div className="flex flex-col items-center pt-1 text-center">
          <ContactAvatar contact={contact} className="h-20 w-20 text-2xl" />
          <h2 className="text-ios-title mt-3">{fullName(contact)}</h2>
          {subtitle && (
            <p className="text-ios-subhead mt-1 text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <ReconnectBadge contact={contact} />
            {tags.map((t) => (
              <TagBadge key={t.id} tag={t} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction icon={Check} label="Caught up" onClick={() => void markCaughtUp(contact)} />
          <QuickAction icon={CalendarPlus} label="Schedule" onClick={() => setScheduling(true)} />
          <QuickAction icon={Send} label="Message" onClick={() => setComposing(true)} />
          <QuickAction icon={Coffee} label="Prep" onClick={() => setPrepping(true)} />
        </div>

        <PhoneContactReminders contact={contact} />

        <InsetGroup title="Contact">
          {channels.map((row, i) => (
            <ValueRow
              key={row.key}
              label={row.label}
              value={row.value}
              href={row.href}
              external={row.external}
              last={missing.length === 0 && i === channels.length - 1}
            />
          ))}
          {missing.map((row, i) => (
            <InsetRow
              key={row.field}
              leading={<Plus className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />}
              title={<span className="text-brand">{row.label}</span>}
              chevron={false}
              last={i === missing.length - 1}
              onClick={() => edit(row.field)}
            />
          ))}
        </InsetGroup>

        <InsetGroup title="How you met">
          {contact.howWeMet ? (
            <button
              type="button"
              onClick={() => edit('howWeMet')}
              className="press-row flex w-full items-stretch pl-4 text-left"
            >
              <span
                className={cn(
                  'flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4',
                  (contact.whereWeMet || contact.dateMet) && 'hairline-b',
                )}
              >
                <span className="text-ios-subhead leading-relaxed">{contact.howWeMet}</span>
              </span>
            </button>
          ) : (
            <InsetRow
              leading={<Plus className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />}
              title={<span className="text-brand">Add how you met</span>}
              chevron={false}
              last={!contact.whereWeMet && !contact.dateMet}
              onClick={() => edit('howWeMet')}
            />
          )}
          {contact.whereWeMet && (
            <InsetRow
              title="Where"
              detail={contact.whereWeMet}
              chevron={false}
              last={!contact.dateMet}
              onClick={() => edit()}
            />
          )}
          {contact.dateMet && (
            <InsetRow
              title="Date met"
              detail={formatDate(contact.dateMet)}
              chevron={false}
              last
              onClick={() => edit()}
            />
          )}
        </InsetGroup>

        <InsetGroup title="Background">
          {background.map((row, i) => (
            <InsetRow
              key={row.label}
              title={row.label}
              detail={row.value}
              chevron={false}
              last={i === background.length - 1 && !introducer}
              onClick={() => edit()}
            />
          ))}
          {introducer && (
            <InsetRow
              title="Introduced by"
              detail={<span className="text-brand">{fullName(introducer)}</span>}
              chevron={false}
              last
              onClick={() => navigate(ROUTES.contact(introducer.id))}
            />
          )}
          {background.length === 0 && !introducer && (
            <InsetRow
              leading={<Plus className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />}
              title={<span className="text-brand">Add their background</span>}
              chevron={false}
              last
              onClick={() => edit()}
            />
          )}
        </InsetGroup>

        <InsetGroup title="Keeping in touch" footer={status.overdue ? status.reason : undefined}>
          <InsetRow
            title="Last contact"
            detail={contact.lastContactDate ? formatRelative(contact.lastContactDate) : 'Never'}
            chevron={false}
            onClick={() => edit()}
          />
          <InsetRow
            title="Catch-up goal"
            detail={FREQUENCY_OPTIONS[contact.contactFrequencyGoal].label}
            chevron={false}
            onClick={() => edit()}
          />
          <InsetRow
            title="Closeness"
            detail={STRENGTH_LABELS[contact.relationshipStrength]}
            chevron={false}
            onClick={() => edit()}
          />
          <InsetRow
            title="Added"
            detail={formatDate(contact.createdAt.slice(0, 10))}
            chevron={false}
            last
          />
        </InsetGroup>

        <InsetGroup title="Notes">
          {notesHtml ? (
            <button
              type="button"
              onClick={() => edit('notes')}
              className="press-row flex w-full items-stretch pl-4 text-left"
            >
              <span className="flex min-w-0 flex-1 py-3 pr-4">
                <span
                  className="prose-notes text-ios-subhead"
                  dangerouslySetInnerHTML={{ __html: notesHtml }}
                />
              </span>
            </button>
          ) : (
            <InsetRow
              leading={<Plus className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />}
              title={<span className="text-brand">Add a note</span>}
              chevron={false}
              last
              onClick={() => edit('notes')}
            />
          )}
        </InsetGroup>

        <InsetGroup title="Meetings">
          {upcomingMeetings.map((e) => (
            <InsetRow
              key={e.id}
              title={e.title}
              subtitle={`${
                e.allDay ? 'All day' : format(parseISO(e.startsAt), 'EEE d MMM, h:mm a')
              }${e.location ? ` · ${e.location}` : ''}`}
              onClick={() => navigate(ROUTES.calendar)}
            />
          ))}
          <InsetRow
            leading={<CalendarPlus className="h-[18px] w-[18px] text-brand" strokeWidth={2} />}
            title={<span className="text-brand">Schedule a meeting</span>}
            chevron={false}
            last
            onClick={() => setScheduling(true)}
          />
        </InsetGroup>

        <InsetGroup
          title={`Activity${sortedInteractions.length ? ` · ${sortedInteractions.length}` : ''}`}
          footer={
            sortedInteractions.length === 0
              ? 'Meetings you schedule here and emails caught by the browser extension land here on their own.'
              : undefined
          }
        >
          {sortedInteractions.length === 0 ? (
            <InsetRow title={<span className="text-muted-foreground">Nothing yet</span>} chevron={false} last />
          ) : (
            sortedInteractions.map((it, i) => {
              const Icon = INTERACTION_ICONS[it.type] ?? Clock
              return (
                <div key={it.id} className="flex items-stretch gap-3 pl-4">
                  <span className="flex shrink-0 items-start pt-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground">
                      <Icon className="h-[15px] w-[15px]" />
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex min-w-0 flex-1 items-start gap-2 py-2.5 pr-2',
                      i < sortedInteractions.length - 1 && 'hairline-b',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-ios-body">
                          {INTERACTION_TYPES[it.type]?.label ?? 'Note'}
                        </span>
                        <time className="tnum text-ios-footnote text-muted-foreground">
                          {formatDate(it.date)}
                        </time>
                      </span>
                      {it.summary && (
                        <span className="text-ios-subhead mt-0.5 block text-text-secondary">
                          {it.summary}
                        </span>
                      )}
                      {it.link && (
                        <a
                          href={it.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ios-footnote mt-1 inline-block font-medium text-brand"
                        >
                          Open source
                        </a>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeletingInteraction(it)}
                      aria-label={`Delete ${INTERACTION_TYPES[it.type]?.label ?? 'activity'}`}
                      className="press -mr-1 flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground/70"
                    >
                      <Trash2 className="h-[17px] w-[17px]" />
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </InsetGroup>

        <InsetGroup>
          <InsetRow title="Merge a Duplicate" chevron={false} onClick={() => setMerging(true)} />
          <InsetRow
            title="Delete Contact"
            destructive
            centered
            last
            onClick={() => setDeleting(true)}
          />
        </InsetGroup>
      </div>
    )
  }


  const SourceIcon = contact.source ? SOURCE_ICONS[contact.source] : MapPin

  return (
    <PageShell
      mobile={{
        title: fullName(contact),
        largeTitle: false,
        leading: <BackBarButton label="Contacts" />,
        // Edit is a bar button of its own, as it is in Contacts.app — not a
        // line buried in an overflow menu.
        trailing: <BarButton onClick={() => edit()}>Edit</BarButton>,
      }}
      bodyClassName={isMobile ? 'bg-grouped' : undefined}
      header={
        <PageHeaderBar
          contact={contact}
          onPrep={() => setPrepping(true)}
          onCaughtUp={() => void markCaughtUp(contact)}
          onCompose={() => setComposing(true)}
          onFollowUp={() => followUpsRef.current?.addFollowUp()}
          onEdit={() => setEditing(true)}
          onMerge={() => setMerging(true)}
          onDelete={() => setDeleting(true)}
        />
      }
    >
      {isMobile ? (
        renderPhone()
      ) : (
        <>
        {/* Identity */}
        <div className="mb-5 flex items-start gap-4">
          <ContactAvatar contact={contact} className="h-14 w-14 sm:h-16 sm:w-16" />
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">{fullName(contact)}</h2>
            {(contact.jobTitle || contact.company) && (
              <p className="mt-0.5 text-sm text-text-secondary">
                {[contact.jobTitle, contact.company].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StrengthMeter value={contact.relationshipStrength} showLabel />
              <ReconnectBadge contact={contact} />
              {tags.map((t) => (
                <TagBadge key={t.id} tag={t} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2">
            <Panel>
              {contact.howWeMet && (
                <PanelSection>
                  <SectionLabel>How we met</SectionLabel>
                  <p className="text-sm leading-relaxed">{contact.howWeMet}</p>
                  {(contact.whereWeMet || contact.dateMet) && (
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {contact.whereWeMet && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {contact.whereWeMet}
                        </span>
                      )}
                      {contact.dateMet && (
                        <time className="tnum inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(contact.dateMet)}
                        </time>
                      )}
                    </div>
                  )}
                </PanelSection>
              )}

              {notesHtml && (
                <PanelSection>
                  <SectionLabel>Notes</SectionLabel>
                  <div className="prose-notes" dangerouslySetInnerHTML={{ __html: notesHtml }} />
                </PanelSection>
              )}

              <DesktopFollowUps ref={followUpsRef} contact={contact} />

              <PanelSection className="px-0 py-0">
                <div className="flex h-11 items-center justify-between px-4">
                  <SectionLabel className="mb-0">
                    Meetings
                    {upcomingMeetings.length > 0 && (
                      <span className="tnum ml-2 font-normal">{upcomingMeetings.length}</span>
                    )}
                  </SectionLabel>
                  <Button size="sm" variant="ghost" onClick={() => setScheduling(true)}>
                    <CalendarPlus />
                    Schedule
                  </Button>
                </div>
                {upcomingMeetings.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Nothing scheduled with {contact.firstName} yet.
                  </p>
                ) : (
                  <ul className="border-t">
                    {upcomingMeetings.map((e) => (
                      <li key={e.id} className="border-b last:border-b-0">
                        <Link
                          to={ROUTES.calendar}
                          className="flex items-center gap-3 px-4 py-2 transition-colors duration-fast hover:bg-accent/50"
                        >
                          <time className="tnum flex w-10 shrink-0 flex-col items-center rounded-md border py-1 leading-none">
                            <span className="text-label text-muted-foreground">
                              {format(parseISO(e.startsAt), 'MMM')}
                            </span>
                            <span className="mt-0.5 text-sm font-semibold">
                              {format(parseISO(e.startsAt), 'd')}
                            </span>
                          </time>
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{e.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {e.allDay ? 'All day' : format(parseISO(e.startsAt), 'EEE, h:mm a')}
                              {e.location ? ` · ${e.location}` : ''}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelSection>

              <PanelSection className="px-0 py-0">
                <div className="flex h-11 items-center px-4">
                  <SectionLabel className="mb-0">
                    Activity
                    <span className="tnum ml-2 font-normal">{sortedInteractions.length}</span>
                  </SectionLabel>
                </div>
                {sortedInteractions.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Nothing yet. Meetings you schedule here and emails caught by the browser
                    extension land in this feed on their own.
                  </p>
                ) : (
                  <ol className="border-t">
                    {sortedInteractions.map((it) => {
                      const Icon = INTERACTION_ICONS[it.type] ?? Clock
                      return (
                        <li
                          key={it.id}
                          className="group flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-bg-sunken text-muted-foreground">
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {INTERACTION_TYPES[it.type]?.label ?? 'Note'}
                              </span>
                              <time className="tnum text-xs text-muted-foreground">
                                {formatDate(it.date)}
                              </time>
                            </div>
                            {it.summary && (
                              <p className="mt-0.5 text-sm text-text-secondary">{it.summary}</p>
                            )}
                            {it.link && (
                              <a
                                href={it.link}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                              >
                                Open source
                              </a>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Activity actions"
                                className="text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setDeletingInteraction(it)}
                                className="text-danger focus:text-danger"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </PanelSection>
            </Panel>
          </div>

          {/* Sidebar */}
          <div>
            <Panel>
              <PanelSection className="space-y-2">
                <SectionLabel>Contact</SectionLabel>
                <ContactChannel icon={Mail} href={contact.email ? `mailto:${contact.email}` : undefined} value={contact.email} label="Email" />
                <ContactChannel icon={Phone} href={contact.phone ? `tel:${contact.phone}` : undefined} value={contact.phone} label="Phone" />
                <ContactChannel icon={Globe} href={contact.linkedinUrl} value={contact.linkedinUrl ? 'LinkedIn' : undefined} label="LinkedIn" external />
                <ContactChannel icon={AtSign} href={contact.twitter} value={contact.twitter ? 'X / Twitter' : undefined} label="Twitter" external />
                {contact.otherLinks.map((l) => (
                  <ContactChannel key={l.id} icon={Link2} href={l.url} value={l.label || l.url} label="Link" external />
                ))}
                {!hasAnyChannel(contact) && (
                  <p className="text-xs text-muted-foreground">No contact details yet.</p>
                )}
              </PanelSection>

              {hasBackgroundInfo(contact) && (
                <PanelSection className="space-y-2">
                  <SectionLabel>Background</SectionLabel>
                  {contact.connectionType && (
                    <InfoRow icon={ConnectionIcon} label="Relationship" value={CONNECTION_TYPES[contact.connectionType].label} />
                  )}
                  {contact.source && (
                    <InfoRow icon={SourceIcon} label="How you met" value={MEET_SOURCES[contact.source].label} />
                  )}
                  {contact.school && <InfoRow icon={GraduationCap} label="School" value={contact.school} />}
                  {(contact.major || contact.gradYear) && (
                    <InfoRow
                      icon={GraduationCap}
                      label="Program"
                      value={[contact.major, contact.gradYear && `’${contact.gradYear.slice(-2)}`].filter(Boolean).join(' · ')}
                    />
                  )}
                  {contact.introducedById && introducer && (
                    <InfoRow
                      icon={Link2}
                      label="Introduced by"
                      value=""
                      valueNode={
                        <Link to={ROUTES.contact(introducer.id)} className="font-medium text-brand hover:underline">
                          {fullName(introducer)}
                        </Link>
                      }
                    />
                  )}
                </PanelSection>
              )}

              <PanelSection className="space-y-2">
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
                <InfoRow icon={Repeat} label="Cadence" value={FREQUENCY_OPTIONS[contact.contactFrequencyGoal].label} />
                <InfoRow
                  icon={status.overdue ? Clock : CalendarDays}
                  label="Status"
                  value={status.reason}
                  valueClass={status.overdue ? 'text-warning' : undefined}
                />
                <InfoRow icon={Building2} label="Industry" value={contact.industry || '—'} />
                <InfoRow icon={CalendarDays} label="Added" value={formatDate(contact.createdAt.slice(0, 10))} />
                <p className="pt-1 text-xs text-muted-foreground">
                  Strength: {STRENGTH_LABELS[contact.relationshipStrength]}
                </p>
              </PanelSection>

              <DesktopKeyDates contact={contact} />
            </Panel>
          </div>
        </div>
        </>
      )}

      <ContactFormDialog
        open={editing}
        onOpenChange={setEditing}
        contact={contact}
        focusField={editField}
      />
      <MergeContactDialog open={merging} onOpenChange={setMerging} primary={contact} />
      <EventFormDialog open={scheduling} onOpenChange={setScheduling} defaultContactId={contact.id} />
      <CoffeeChatPrepDialog
        open={prepping}
        onOpenChange={setPrepping}
        contactId={contact.id}
        onCompose={() => {
          setPrepping(false)
          setComposing(true)
        }}
        onMarkCaughtUp={() => {
          setPrepping(false)
          void markCaughtUp(contact)
        }}
      />
      <ComposeDialog open={composing} onOpenChange={setComposing} contactId={contact.id} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${fullName(contact)}?`}
        description="This permanently removes the contact and their activity history."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={Boolean(deletingInteraction)}
        onOpenChange={(o) => !o && setDeletingInteraction(null)}
        title="Delete this activity?"
        description="The last-contact date will be recalculated from what remains."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteInteraction}
      />
    </PageShell>
  )
}

/** One of the four things you do to a contact, as an iOS action button. */
function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Mail
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press-scale flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-[14px] bg-grouped-cell px-1"
    >
      <Icon className="h-[19px] w-[19px] text-brand" strokeWidth={2} />
      <span className="text-ios-caption text-center leading-tight text-text-secondary">{label}</span>
    </button>
  )
}

/**
 * A saved detail: the label above the value, the way Contacts.app shows a
 * phone number — and the whole row acts on it (mail, dial, open).
 */
function ValueRow({
  label,
  value,
  href,
  external,
  last,
}: {
  label: string
  value: string
  href: string
  external?: boolean
  last?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="press-row flex w-full items-stretch pl-4 text-left"
    >
      <span
        className={cn(
          'flex min-h-[54px] min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-4',
          !last && 'hairline-b',
        )}
      >
        <span className="text-ios-footnote text-muted-foreground">{label}</span>
        <span className="text-ios-body truncate text-brand">{value}</span>
      </span>
    </a>
  )
}

/** The pinned bar: back, compact identity, primary actions. */
function PageHeaderBar({
  contact,
  onPrep,
  onCaughtUp,
  onCompose,
  onFollowUp,
  onEdit,
  onMerge,
  onDelete,
}: {
  contact?: Contact
  onPrep?: () => void
  onCaughtUp?: () => void
  onCompose?: () => void
  onFollowUp?: () => void
  onEdit?: () => void
  onMerge?: () => void
  onDelete?: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Back" className="shrink-0 text-muted-foreground">
          <ArrowLeft />
        </Button>
        <h1 className="truncate text-sm font-semibold">{contact ? fullName(contact) : 'Contact'}</h1>
      </div>

      {contact && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onPrep}>
            <Coffee />
            <span className="hidden sm:inline">Prep</span>
          </Button>
          <Button size="sm" onClick={onCaughtUp}>
            <Check />
            <span className="hidden sm:inline">Caught up</span>
          </Button>
          <ContactActionsMenu
            onCompose={onCompose}
            onFollowUp={onFollowUp}
            onEdit={onEdit}
            onMerge={onMerge}
            onDelete={onDelete}
            trigger={
              <Button variant="outline" size="icon-sm" aria-label="More">
                <MoreHorizontal />
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}

function ContactActionsMenu({
  trigger,
  onCompose,
  onFollowUp,
  onEdit,
  onMerge,
  onDelete,
}: {
  trigger: React.ReactNode
  onCompose?: () => void
  onFollowUp?: () => void
  onEdit?: () => void
  onMerge?: () => void
  onDelete?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCompose}>
          <Send /> Send a message
        </DropdownMenuItem>
        {onFollowUp && (
          <DropdownMenuItem onClick={onFollowUp}>
            <AlarmClockPlus /> Set a follow-up
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil /> Edit contact
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMerge}>
          <Merge /> Merge duplicate…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger">
          <Trash2 /> Delete contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function hasAnyChannel(c: Contact): boolean {
  return Boolean(c.email || c.phone || c.linkedinUrl || c.twitter || c.otherLinks.length)
}

function hasBackgroundInfo(c: Contact): boolean {
  return Boolean(c.connectionType || c.source || c.school || c.major || c.gradYear || c.introducedById)
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-label mb-2 text-muted-foreground', className)}>{children}</h2>
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
    <span className="flex items-center gap-2.5 text-sm">
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
      className="block truncate rounded-sm text-foreground transition-colors duration-fast hover:text-brand"
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
      <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={cn('min-w-0 text-right', valueClass)}>{valueNode ?? value}</span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <PageShell
      mobile={{ largeTitle: false, leading: <BackBarButton label="Contacts" /> }}
      header={<PageHeaderBar />}
    >
      <div className="flex items-start gap-4" aria-busy="true">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 pt-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 w-full lg:col-span-2" />
        <Skeleton className="h-64 w-full" />
      </div>
    </PageShell>
  )
}
