import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Building2,
  CalendarPlus,
  Check,
  ChevronLeft,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  MessageSquare,
  PenLine,
  Repeat,
  Settings,
  Tag as TagIcon,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts, useTagMap, useTags, useTemplates } from '@/hooks/useData'
import { contactRepo } from '@/services'
import { buildSearchIndex, searchContacts } from '@/lib/search'
import { markCaughtUp } from '@/lib/caughtUp'
import { FREQUENCY_KEYS, FREQUENCY_OPTIONS, TEMPLATE_CATEGORIES } from '@/lib/constants'
import { distinctValues } from '@/lib/filters'
import { fullName, formatRelativeShort } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Contact, ContactFrequency } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNewContact: () => void
  onVoiceCapture: () => void
  /** Hands the typed query to the natural-language search over contacts. */
  onAssistant: (question: string) => void
}

/**
 * Which step of a two-step action the palette is on. `root` is the normal
 * list; the others narrow it to a person, then (for cadence) a frequency.
 */
type Mode =
  | { kind: 'root' }
  | { kind: 'caught-up' }
  | { kind: 'cadence' }
  | { kind: 'cadence-pick'; contact: Contact }

const MODE_PLACEHOLDER: Record<Mode['kind'], string> = {
  root: 'Search people, companies, tags — or run an action',
  'caught-up': 'Who did you catch up with?',
  cadence: 'Set a cadence for…',
  'cadence-pick': 'How often?',
}

/**
 * ⌘K. Finds people, companies and tags, and runs the actions that would
 * otherwise take three clicks: log a touch, set a cadence, start an
 * opportunity or meeting, use a template.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onNewContact,
  onVoiceCapture,
  onAssistant,
}: Props) {
  const navigate = useNavigate()
  const contacts = useContacts()
  const tags = useTags() ?? []
  const templates = useTemplates() ?? []
  const tagMap = useTagMap()
  const [query, setQuery] = React.useState('')
  const [mode, setMode] = React.useState<Mode>({ kind: 'root' })

  const fuse = React.useMemo(
    () => buildSearchIndex(contacts ?? [], tagMap),
    [contacts, tagMap],
  )

  const q = query.trim()
  const people = React.useMemo(
    () => (q ? searchContacts(fuse, q).slice(0, 8) : []),
    [fuse, q],
  )
  const matchingTags = React.useMemo(
    () => (q ? tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : []),
    [tags, q],
  )
  const companies = React.useMemo(() => {
    if (!q) return []
    return distinctValues(contacts ?? [], 'company')
      .filter((c) => c.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 4)
  }, [contacts, q])
  const matchingTemplates = React.useMemo(
    () =>
      q
        ? templates.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
        : [],
    [templates, q],
  )

  // Fresh every time it opens.
  React.useEffect(() => {
    if (open) {
      setQuery('')
      setMode({ kind: 'root' })
    }
  }, [open])

  function run(action: () => void) {
    onOpenChange(false)
    setTimeout(action, 0)
  }

  function enter(next: Mode) {
    setMode(next)
    setQuery('')
  }

  /** People for the two-step actions: the search results, or the most recent. */
  const pickList = React.useMemo(() => {
    if (q) return people
    return [...(contacts ?? [])]
      .sort((a, b) => (b.lastContactDate ?? '').localeCompare(a.lastContactDate ?? ''))
      .slice(0, 8)
  }, [contacts, people, q])

  async function setCadence(contact: Contact, freq: ContactFrequency) {
    await contactRepo.update(contact.id, { contactFrequencyGoal: freq })
    toast.success(`${contact.firstName}: ${FREQUENCY_OPTIONS[freq].label.toLowerCase()}`)
  }

  const backItem = (
    <CommandItem value="back" onSelect={() => enter({ kind: 'root' })}>
      <ChevronLeft /> Back
    </CommandItem>
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={MODE_PLACEHOLDER[mode.kind]}
        value={query}
        onValueChange={setQuery}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && !query && mode.kind !== 'root') {
            e.preventDefault()
            enter({ kind: 'root' })
          }
        }}
      />
      <CommandList>
        {/* ---- Step two of "set cadence": pick a frequency ---- */}
        {mode.kind === 'cadence-pick' && (
          <CommandGroup heading={`Cadence for ${fullName(mode.contact)}`}>
            {FREQUENCY_KEYS.map((k) => (
              <CommandItem
                key={k}
                value={`freq-${k}`}
                onSelect={() => run(() => void setCadence(mode.contact, k))}
              >
                <Repeat />
                {FREQUENCY_OPTIONS[k].label}
                {mode.contact.contactFrequencyGoal === k && (
                  <CommandShortcut>
                    <Check className="h-3.5 w-3.5" />
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
            {backItem}
          </CommandGroup>
        )}

        {/* ---- Step one of the two-step actions: pick a person ---- */}
        {(mode.kind === 'caught-up' || mode.kind === 'cadence') && (
          <>
            <CommandEmpty>No one matches “{query}”.</CommandEmpty>
            <CommandGroup heading={q ? 'People' : 'Recent'}>
              {pickList.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`pick-${c.id}`}
                  keywords={[fullName(c), c.company ?? '']}
                  onSelect={() => {
                    if (mode.kind === 'caught-up') {
                      run(() => {
                        void markCaughtUp(c)
                        toast.success(`Caught up with ${c.firstName}`)
                      })
                    } else {
                      enter({ kind: 'cadence-pick', contact: c })
                    }
                  }}
                >
                  <ContactAvatar contact={c} className="h-5 w-5" />
                  <span className="truncate">{fullName(c)}</span>
                  <CommandShortcut>{formatRelativeShort(c.lastContactDate)}</CommandShortcut>
                </CommandItem>
              ))}
              {backItem}
            </CommandGroup>
          </>
        )}

        {mode.kind === 'root' && (
          <>
            <CommandEmpty>
              No results for “{query}”. Try a company, a tag, or where you met.
            </CommandEmpty>

            {people.length > 0 && (
              <CommandGroup heading="People">
                {people.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`person-${c.id}`}
                    keywords={[q, fullName(c), c.company ?? '', c.jobTitle ?? '']}
                    onSelect={() => run(() => navigate(ROUTES.contact(c.id)))}
                  >
                    <ContactAvatar contact={c} className="h-5 w-5" />
                    <span className="truncate">{fullName(c)}</span>
                    {(c.jobTitle || c.company) && (
                      <span className="truncate text-xs text-muted-foreground">
                        {[c.jobTitle, c.company].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <CommandShortcut>{formatRelativeShort(c.lastContactDate)}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(matchingTags.length > 0 || companies.length > 0) && (
              <CommandGroup heading="Filter contacts">
                {matchingTags.map((t) => (
                  <CommandItem
                    key={`tag-${t.id}`}
                    value={`tag-${t.id}`}
                    keywords={[t.name]}
                    onSelect={() => run(() => navigate(ROUTES.contactsSearch(t.name)))}
                  >
                    <TagIcon /> {t.name}
                    <CommandShortcut>tag</CommandShortcut>
                  </CommandItem>
                ))}
                {companies.map((name) => (
                  <CommandItem
                    key={`co-${name}`}
                    value={`co-${name}`}
                    keywords={[name]}
                    onSelect={() => run(() => navigate(ROUTES.contactsSearch(name)))}
                  >
                    <Building2 /> {name}
                    <CommandShortcut>company</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchingTemplates.length > 0 && (
              <CommandGroup heading="Use a template">
                {matchingTemplates.map((t) => (
                  <CommandItem
                    key={`tpl-${t.id}`}
                    value={`tpl-${t.id}`}
                    keywords={[t.name]}
                    onSelect={() => run(() => navigate(ROUTES.templateUse(t.id)))}
                  >
                    <Mail /> {t.name}
                    <CommandShortcut>{TEMPLATE_CATEGORIES[t.category].label}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {q.length > 2 && (
              <CommandGroup heading="Ask">
                <CommandItem
                  value="ask-network"
                  keywords={[q]}
                  onSelect={() => run(() => onAssistant(q))}
                >
                  <MessageSquare /> Ask about your network: “{q}”
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Actions">
              <CommandItem value="say-who-you-met" onSelect={() => run(onVoiceCapture)}>
                <PenLine /> Say who you met
                <CommandShortcut>V</CommandShortcut>
              </CommandItem>
              <CommandItem value="new-contact" onSelect={() => run(onNewContact)}>
                <UserPlus /> New contact
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>
              <CommandItem value="caught-up" onSelect={() => enter({ kind: 'caught-up' })}>
                <Check /> Caught up with…
              </CommandItem>
              <CommandItem value="set-cadence" onSelect={() => enter({ kind: 'cadence' })}>
                <Repeat /> Set cadence for…
              </CommandItem>
              <CommandItem
                value="new-opportunity"
                onSelect={() => run(() => navigate(ROUTES.pipelineNew))}
              >
                <KanbanSquare /> New opportunity
              </CommandItem>
              <CommandItem
                value="new-meeting"
                onSelect={() => run(() => navigate(ROUTES.calendarNew))}
              >
                <CalendarPlus /> Schedule a meeting
              </CommandItem>
              {templates.length > 0 && !q && (
                <CommandItem
                  value="use-template"
                  onSelect={() => run(() => navigate(ROUTES.templates))}
                >
                  <Mail /> Use a template
                </CommandItem>
              )}
            </CommandGroup>

            {!q && (
              <CommandGroup heading="Go to">
                <CommandItem value="go-dashboard" onSelect={() => run(() => navigate(ROUTES.dashboard))}>
                  <LayoutDashboard /> Dashboard
                </CommandItem>
                <CommandItem value="go-contacts" onSelect={() => run(() => navigate(ROUTES.contacts))}>
                  <Users /> Contacts
                </CommandItem>
                <CommandItem value="go-pipeline" onSelect={() => run(() => navigate(ROUTES.pipeline))}>
                  <KanbanSquare /> Pipeline
                </CommandItem>
                <CommandItem value="go-assistant" onSelect={() => run(() => onAssistant(''))}>
                  <MessageSquare /> Assistant
                </CommandItem>
                <CommandItem value="go-templates" onSelect={() => run(() => navigate(ROUTES.templates))}>
                  <Mail /> Templates
                </CommandItem>
                <CommandItem value="go-tags" onSelect={() => run(() => navigate(ROUTES.tags))}>
                  <TagIcon /> Tags
                </CommandItem>
                <CommandItem value="go-settings" onSelect={() => run(() => navigate(ROUTES.settings))}>
                  <Settings /> Settings
                </CommandItem>
              </CommandGroup>
            )}

            {q && people.length > 0 && (
              <CommandGroup heading="Jump to">
                <CommandItem
                  value="view-all-matches"
                  keywords={[q]}
                  onSelect={() => run(() => navigate(ROUTES.contactsSearch(q)))}
                >
                  <Users /> All contacts matching “{q}”
                </CommandItem>
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
