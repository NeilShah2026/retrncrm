import type { JSX } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  contactName,
  createContact,
  findContactByLinkedin,
  findContactsByEmails,
  findContactsByName,
  getTags,
  INTERACTION_TYPES,
  logInteraction,
  loggedEntry,
  type Contact,
  type Interaction,
  type InteractionInput,
  type Tag,
} from '../db'
import { contactUrl } from '../config'
import type { EmailContext, LinkedInMessageContext, Person } from '../types'
import {
  companyFromEmail,
  lastTouch,
  nameFromEmail,
  overdueBy,
  shortDate,
  TAG_DOTS,
  today,
} from '../ui/format'
import { ArrowUpRight, ChevronDown, Mail } from '../ui/icons'
import { Avatar, ErrorNotice, Frame, SkeletonRows } from './common'
import { openUrl, type Host } from './host'
import { Success, type SavedResult } from './Success'

/** How many people a large thread lists before "Show all". */
const COLLAPSED_PEOPLE = 5
const SUMMARY_MAX = 500

interface Draft {
  key: string
  person: Person
  /** Confident match: same email or LinkedIn profile. */
  match: Contact | null
  /** Same name, different or missing email — maybe the same person. */
  candidates: Contact[]
  /** A contact id, or 'new'. */
  target: string
  selected: boolean
  name: string
  company: string
  /** Already logged for this thread. */
  logged?: Interaction
}

type Props = {
  host: Host
  account: string
  context: EmailContext | LinkedInMessageContext
}

/**
 * Logging an email thread (or a LinkedIn conversation) to the people on it.
 * Everyone on the thread is listed with whether they're already in Retrn,
 * when you were last in touch, and whether this thread is already logged; new
 * people are added as contacts in the same step.
 */
export function LogScreen({ host, account, context }: Props) {
  const isEmail = context.kind === 'email'
  const threadKey = isEmail ? context.threadKey : context.link

  const people = useMemo(() => {
    if (!isEmail) return [context.person]
    const mine = new Set([account, ...context.me].map((e) => e.toLowerCase()))
    const others = context.participants.filter((p) => !p.email || !mine.has(p.email.toLowerCase()))
    return others.length > 0 ? others : context.participants
  }, [context, account, isEmail])

  const primaryEmail = useMemo(() => {
    if (!isEmail) return undefined
    const from = context.lastFrom?.toLowerCase()
    return people.find((p) => p.email?.toLowerCase() === from)?.email ?? people[0]?.email
  }, [people, context, isEmail])

  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const baseSummary = isEmail ? context.subject || 'Email' : 'LinkedIn message'
  const [type, setType] = useState(isEmail ? 'email' : 'linkedin')
  const [date, setDate] = useState((isEmail && context.date) || today())
  const [summary, setSummary] = useState(baseSummary)
  const [includeText, setIncludeText] = useState(false)
  const [attachLink, setAttachLink] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedResult[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setDrafts(null)
    setLoadError(null)
    void (async () => {
      try {
        const byEmail = await findContactsByEmails(people.map((p) => p.email ?? ''))
        const next: Draft[] = []
        for (const person of people) {
          const email = person.email?.toLowerCase()
          let match = byEmail.find((c) => email && c.email?.toLowerCase() === email) ?? null
          if (!match && person.linkedinUrl) match = await findContactByLinkedin(person.linkedinUrl)
          const displayName =
            person.name && !person.name.includes('@') ? person.name : nameFromEmail(person.email ?? person.name)
          const candidates = match || !displayName ? [] : await findContactsByName(displayName)
          // One contact with exactly this name and no email yet is almost
          // certainly them: log to it (and give it the address) rather than
          // creating a second copy.
          const sameName = candidates.filter(
            (c) => !c.email && contactName(c).toLowerCase() === displayName.toLowerCase(),
          )
          const likely = sameName.length === 1 ? sameName[0] : null
          const logged = match ? loggedEntry(match, threadKey) : undefined
          const isPrimary = !isEmail || person.email === primaryEmail
          next.push({
            key: person.email ?? person.linkedinUrl ?? person.name,
            person,
            match,
            candidates,
            target: match?.id ?? likely?.id ?? 'new',
            selected: !logged && Boolean(match || isPrimary),
            name: displayName,
            company: companyFromEmail(person.email),
            logged,
          })
        }
        if (!cancelled) setDrafts(next)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Couldn’t load your contacts.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [people, threadKey, primaryEmail, isEmail, attempt])

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((list) => list?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null)
  }

  function toggleText(on: boolean) {
    setIncludeText(on)
    const snippet = isEmail ? context.snippet : undefined
    setSummary(on && snippet ? `${baseSummary} — ${snippet}`.slice(0, SUMMARY_MAX) : baseSummary)
  }

  const chosen = drafts?.filter((d) => d.selected) ?? []
  const allLogged = Boolean(drafts?.length) && drafts!.every((d) => d.logged)

  async function save() {
    if (chosen.length === 0) return
    setSaving(true)
    setSaveError(null)
    const input: InteractionInput = {
      type,
      date: date || today(),
      summary: summary.trim() || baseSummary,
      link: attachLink ? context.link : undefined,
    }
    const results: SavedResult[] = []
    const failures: string[] = []
    for (const draft of chosen) {
      try {
        if (draft.target !== 'new') {
          const { contact, undo } = await logInteraction(draft.target, input, {
            email: draft.person.email,
            linkedin_url: draft.person.linkedinUrl,
          })
          results.push({ contact, undo, created: false })
        } else {
          const { contact, undo } = await createContact(
            {
              name: draft.name.trim() || draft.person.email || draft.person.name,
              email: draft.person.email,
              linkedinUrl: draft.person.linkedinUrl,
              company: draft.company,
            },
            input,
          )
          results.push({ contact, undo, created: true })
        }
      } catch (err) {
        failures.push(`${draft.name || draft.person.email}: ${err instanceof Error ? err.message : 'not saved'}`)
      }
    }
    setSaving(false)
    if (results.length > 0) {
      host.onLogged?.()
      setSaved(results)
      if (failures.length) setSaveError(failures.join('\n'))
    } else {
      setSaveError(failures.join('\n') || 'Nothing was saved.')
    }
  }

  if (saved) {
    return (
      <Success
        host={host}
        account={account}
        results={saved}
        verb={type === 'email' ? 'Email logged' : 'Logged'}
        failures={saveError}
        onUndone={() => {
          setSaved(null)
          setSaveError(null)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }

  const visibleDrafts = showAll ? drafts : drafts?.slice(0, COLLAPSED_PEOPLE)
  const hidden = (drafts?.length ?? 0) - (visibleDrafts?.length ?? 0)
  const label =
    chosen.length === 0
      ? 'Choose who to log this to'
      : chosen.length === 1
        ? `Log to ${firstName(chosen[0])}`
        : `Log to ${chosen.length} people`

  return (
    <Frame
      host={host}
      account={account}
      footer={
        drafts && (
          <>
            {saveError && (
              <div class="field">
                <ErrorNotice>
                  <span style={{ whiteSpace: 'pre-line' }}>{saveError}</span>
                </ErrorNotice>
              </div>
            )}
            <button
              class="btn btn-primary btn-block"
              disabled={saving || chosen.length === 0}
              aria-busy={saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : label}
            </button>
          </>
        )
      }
    >
      <div class="thread">
        <span class="thread-icon">
          <Mail size={15} />
        </span>
        <div class="row-main">
          <div class="row-title clamp-2">{isEmail ? context.subject || '(no subject)' : context.person.name}</div>
          <div class="row-sub">
            {isEmail
              ? `${context.provider === 'gmail' ? 'Gmail' : 'Outlook'}${context.date ? ` · ${shortDate(context.date)}` : ''}`
              : 'LinkedIn conversation'}
          </div>
        </div>
      </div>

      <p class="section-label">{people.length === 1 ? 'Log to' : `People on this ${isEmail ? 'email' : 'thread'}`}</p>

      {loadError ? (
        <ErrorNotice>
          {loadError}{' '}
          <button class="link" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </ErrorNotice>
      ) : !drafts ? (
        <SkeletonRows count={Math.min(people.length, 3)} />
      ) : (
        <div class="panel">
          {visibleDrafts!.map((draft) => (
            <PersonRow key={draft.key} host={host} draft={draft} onChange={(p) => update(draft.key, p)} />
          ))}
          {hidden > 0 && (
            <button class="row small link" style={{ justifyContent: 'center' }} onClick={() => setShowAll(true)}>
              Show {hidden} more
            </button>
          )}
        </div>
      )}

      {allLogged && (
        <p class="small muted mt-8">
          Already logged. Tick someone to log it again.
        </p>
      )}

      <p class="section-label mt-16">Details</p>
      <div class="grid-2 field">
        <div>
          <label class="label" for="type">
            Type
          </label>
          <select id="type" class="select" value={type} onChange={(e) => setType(e.currentTarget.value)}>
            {INTERACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label class="label" for="date">
            Date
          </label>
          <input id="date" class="input tnum" type="date" value={date} max={today()} onInput={(e) => setDate(e.currentTarget.value)} />
        </div>
      </div>
      <div class="field">
        <label class="label" for="summary">
          Summary
        </label>
        <textarea
          id="summary"
          class="textarea"
          rows={2}
          maxLength={SUMMARY_MAX}
          value={summary}
          onInput={(e) => setSummary(e.currentTarget.value)}
        />
      </div>
      {isEmail && context.snippet && (
        <label class="check-row field">
          <input
            type="checkbox"
            class="checkbox"
            checked={includeText}
            onChange={(e) => toggleText(e.currentTarget.checked)}
          />
          Add the latest message’s text
        </label>
      )}
      <label class="check-row">
        <input
          type="checkbox"
          class="checkbox"
          checked={attachLink}
          onChange={(e) => setAttachLink(e.currentTarget.checked)}
        />
        Link back to this {isEmail ? 'email' : 'conversation'}
      </label>
    </Frame>
  )
}

/** The name the save button uses: the contact's, or the one typed for a new person. */
function firstName(draft: Draft): string {
  const contact = draft.match ?? draft.candidates.find((c) => c.id === draft.target)
  const name = draft.target !== 'new' && contact ? contact.first_name : draft.name.split(' ')[0]
  return name || 'new contact'
}

function PersonRow({
  host,
  draft,
  onChange,
}: {
  host: Host
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { person, match, candidates, logged } = draft
  const targetContact = match ?? candidates.find((c) => c.id === draft.target) ?? null
  const isNew = draft.target === 'new'

  let status: JSX.Element
  if (logged) {
    status = <span class="badge badge-success">Logged {shortDate(logged.date)}</span>
  } else if (targetContact) {
    const over = overdueBy(targetContact)
    status = over ? (
      <span class="badge badge-warning">Overdue {over}d</span>
    ) : (
      <span class="badge">In Retrn</span>
    )
  } else {
    status = <span class="badge">New</span>
  }

  return (
    <div class={`person${draft.selected ? '' : ' is-off'}`}>
      <div class="person-line">
        <input
          type="checkbox"
          class="checkbox"
          checked={draft.selected}
          onChange={(e) => onChange({ selected: e.currentTarget.checked })}
          aria-label={`Log to ${draft.name}`}
        />
        <Avatar name={targetContact ? contactName(targetContact) : draft.name} />
        <div class="row-main">
          <div class="hstack" style={{ gap: '6px' }}>
            <span class="row-title truncate">{targetContact ? contactName(targetContact) : draft.name}</span>
            {status}
          </div>
          <div class="row-sub truncate">
            {targetContact
              ? [targetContact.job_title, targetContact.company].filter(Boolean).join(' at ') ||
                lastTouch(targetContact)
              : person.email ?? person.linkedinUrl ?? ''}
          </div>
        </div>
        {targetContact && (
          <button
            class="btn btn-ghost btn-icon"
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide details' : 'Show details'}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown size={14} class={expanded ? 'flip' : undefined} />
          </button>
        )}
      </div>

      {draft.selected && (isNew || candidates.length > 0) && (
        <div class="person-extra">
          {candidates.length > 0 && !match && (
            <div class="field">
              <label class="label" for={`t-${draft.key}`}>
                Save to
              </label>
              <select
                id={`t-${draft.key}`}
                class="select"
                value={draft.target}
                onChange={(e) => onChange({ target: e.currentTarget.value })}
              >
                <option value="new">A new contact</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactName(c)}
                    {c.company ? ` · ${c.company}` : c.email ? ` · ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isNew && (
            <div class="grid-2">
              <div>
                <label class="label" for={`n-${draft.key}`}>
                  Name
                </label>
                <input
                  id={`n-${draft.key}`}
                  class="input"
                  value={draft.name}
                  onInput={(e) => onChange({ name: e.currentTarget.value })}
                />
              </div>
              <div>
                <label class="label" for={`c-${draft.key}`}>
                  Company
                </label>
                <input
                  id={`c-${draft.key}`}
                  class="input"
                  placeholder="Optional"
                  value={draft.company}
                  onInput={(e) => onChange({ company: e.currentTarget.value })}
                />
              </div>
            </div>
          )}
          {!isNew && targetContact && !targetContact.email && person.email && (
            <p class="small muted">Adds {person.email} to their contact.</p>
          )}
        </div>
      )}

      {expanded && targetContact && <ContactSnapshot host={host} contact={targetContact} />}
    </div>
  )
}

/** What Retrn already knows about someone: role, cadence, tags, last few touches. */
function ContactSnapshot({ host, contact }: { host: Host; contact: Contact }) {
  const [tags, setTags] = useState<Tag[]>([])
  useEffect(() => {
    void getTags(contact.tag_ids ?? []).then(setTags).catch(() => setTags([]))
  }, [contact.id])

  const recent = [...(contact.interactions ?? [])]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 3)
  const over = overdueBy(contact)

  return (
    <div class="person-extra">
      <p class="small muted">
        {lastTouch(contact)}
        {over ? ` · ${over} days past their catch-up goal` : ''}
      </p>
      {tags.length > 0 && (
        <div class="hstack mt-8" style={{ flexWrap: 'wrap', gap: '4px' }}>
          {tags.map((t) => (
            <span class="tag" key={t.id}>
              <i style={{ background: TAG_DOTS[t.color] ?? TAG_DOTS.slate }} />
              {t.name}
            </span>
          ))}
        </div>
      )}
      {recent.length > 0 ? (
        <ul class="timeline">
          {recent.map((i) => (
            <li key={i.id}>
              <time class="tnum">{shortDate(i.date)}</time>
              <span class="truncate">{i.summary || i.type}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="small muted mt-8">Nothing logged yet.</p>
      )}
      <button class="link small mt-8 hstack" style={{ gap: '4px' }} onClick={() => openUrl(contactUrl(contact.id), host)}>
        Open in Retrn
        <ArrowUpRight size={12} />
      </button>
    </div>
  )
}
