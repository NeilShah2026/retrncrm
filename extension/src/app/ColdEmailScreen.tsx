import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  coldLimitMessage,
  coldName,
  createColdTarget,
  findColdTargetsByEmails,
  logColdSend,
  loggedSend,
  nextFollowUpAfter,
  type ColdSend,
  type ColdTarget,
  type ColdUndo,
  type SendInput,
} from '../cold'
import { coldEmailUrl, contactUrl } from '../config'
import { contactName, findContactsByEmails, type Contact } from '../db'
import type { EmailContext, Person } from '../types'
import { companyFromEmail, nameFromEmail, shortDate, today } from '../ui/format'
import { ArrowUpRight, Check, Send, Undo } from '../ui/icons'
import { Avatar, ErrorNotice, Frame, SkeletonRows } from './common'
import { openUrl, type Host } from './host'

interface Draft {
  key: string
  person: Person
  /** Already on the cold email list. */
  target: ColdTarget | null
  /** Already a contact — logging them here would make a second copy. */
  contact: Contact | null
  /** This thread is already one of their sends. */
  logged?: ColdSend
  selected: boolean
  name: string
  company: string
  role: string
}

interface Saved {
  target: ColdTarget
  created: boolean
  undo: ColdUndo
}

type Props = {
  host: Host
  account: string
  context: EmailContext
  /** Back to logging this thread to contacts. */
  onSwitch: () => void
}

/**
 * Logging a sent email as a cold email: the recipient goes on the cold email
 * list (not into contacts), and Retrn schedules the follow-ups. Someone
 * already on the list gets this logged as their next send.
 */
export function ColdEmailScreen({ host, account, context, onSwitch }: Props) {
  const mine = useMemo(() => new Set([account, ...context.me].map((e) => e.toLowerCase())), [account, context])
  const people = useMemo(
    () => context.participants.filter((p) => p.email && !mine.has(p.email.toLowerCase())),
    [context, mine],
  )
  // Only your own words are worth keeping as what was sent.
  const sentByMe = Boolean(context.lastFrom && mine.has(context.lastFrom.toLowerCase()))

  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [date, setDate] = useState(context.date || today())
  const [subject, setSubject] = useState(context.subject)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setDrafts(null)
    setLoadError(null)
    void (async () => {
      try {
        const emails = people.map((p) => p.email ?? '')
        const [targets, contacts] = await Promise.all([findColdTargetsByEmails(emails), findContactsByEmails(emails)])
        const next: Draft[] = people.map((person, i) => {
          const email = person.email!.toLowerCase()
          const target = targets.find((t) => t.email?.toLowerCase() === email) ?? null
          const contact = contacts.find((c) => c.email?.toLowerCase() === email) ?? null
          const logged = target ? loggedSend(target, context.threadKey) : undefined
          const name = person.name && !person.name.includes('@') ? person.name : nameFromEmail(person.email!)
          return {
            key: email,
            person,
            target,
            contact,
            logged,
            // The first recipient is who a cold email is to; anyone already on
            // the list is being followed up with.
            selected: !logged && !contact && (Boolean(target) || i === 0),
            name,
            company: target?.company ?? companyFromEmail(person.email),
            role: target?.role ?? '',
          }
        })
        if (!cancelled) setDrafts(next)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Couldn’t load your cold emails.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [people, context.threadKey, attempt])

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((list) => list?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null)
  }

  const chosen = drafts?.filter((d) => d.selected) ?? []

  async function save() {
    if (chosen.length === 0) return
    setSaving(true)
    setSaveError(null)
    const input: SendInput = {
      date: date || today(),
      subject,
      link: context.link,
      body: sentByMe ? context.snippet : undefined,
    }
    const results: Saved[] = []
    const failures: string[] = []
    for (const d of chosen) {
      try {
        if (d.target) {
          const { target, undo } = await logColdSend(d.target.id, input)
          results.push({ target, undo, created: false })
        } else {
          const { target, undo } = await createColdTarget(
            { name: d.name.trim() || d.person.email!, email: d.person.email, company: d.company, role: d.role },
            input,
          )
          results.push({ target, undo, created: true })
        }
      } catch (err) {
        const limit = coldLimitMessage(err)
        if (limit) {
          failures.push(limit)
          break
        }
        failures.push(`${d.name || d.person.email}: ${err instanceof Error ? err.message : 'not saved'}`)
      }
    }
    setSaving(false)
    if (results.length > 0) {
      setSaved(results)
      if (failures.length) setSaveError(failures.join('\n'))
    } else {
      setSaveError(failures.join('\n') || 'Nothing was saved.')
    }
  }

  if (saved) {
    return (
      <ColdSaved
        host={host}
        account={account}
        results={saved}
        failures={saveError}
        onUndone={() => {
          setSaved(null)
          setSaveError(null)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }

  const followUps = chosen.filter((d) => d.target).length
  const label =
    chosen.length === 0
      ? 'Choose who you emailed'
      : chosen.length > 1
        ? `Log for ${chosen.length} people`
        : followUps
          ? `Log follow-up to ${firstName(chosen[0])}`
          : `Log cold email to ${firstName(chosen[0])}`

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
          <Send size={15} />
        </span>
        <div class="row-main">
          <div class="row-title clamp-2">{context.subject || '(no subject)'}</div>
          <div class="row-sub">
            Cold email · {context.provider === 'gmail' ? 'Gmail' : 'Outlook'}
            {context.date ? ` · ${shortDate(context.date)}` : ''}
          </div>
        </div>
      </div>

      <p class="small muted mt-8">
        Goes on your cold email list, not your contacts. Retrn reminds you to follow up, and you can make them
        a contact once they reply.{' '}
        <button class="link" onClick={onSwitch}>
          Log to contacts instead
        </button>
      </p>

      <p class="section-label mt-16">{people.length === 1 ? 'Sent to' : 'People on this email'}</p>

      {people.length === 0 ? (
        <ErrorNotice>There’s nobody on this email but you.</ErrorNotice>
      ) : loadError ? (
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
          {drafts.map((d) => (
            <PersonRow key={d.key} host={host} draft={d} onChange={(p) => update(d.key, p)} />
          ))}
        </div>
      )}

      <p class="section-label mt-16">Details</p>
      <div class="grid-2 field">
        <div>
          <label class="label" for="cold-date">
            Sent on
          </label>
          <input
            id="cold-date"
            class="input tnum"
            type="date"
            value={date}
            max={today()}
            onInput={(e) => setDate(e.currentTarget.value)}
          />
        </div>
        <div>
          <span class="label">Next follow-up</span>
          <div class="input tnum" style={{ display: 'flex', alignItems: 'center' }} aria-live="polite">
            {followUpPreview(chosen, date)}
          </div>
        </div>
      </div>
      <div class="field">
        <label class="label" for="cold-subject">
          Subject
        </label>
        <input id="cold-subject" class="input" value={subject} onInput={(e) => setSubject(e.currentTarget.value)} />
      </div>
    </Frame>
  )
}

function firstName(d: Draft): string {
  return (d.target?.first_name || d.name.split(/\s+/)[0] || d.person.email || 'them').trim()
}

/** What the schedule will say once this is logged — before it happens. */
function followUpPreview(chosen: Draft[], date: string): string {
  if (chosen.length === 0) return '—'
  const d = chosen[0]
  if (d.target && (d.target.status === 'replied' || d.target.status === 'converted')) return 'None — they replied'
  const next = nextFollowUpAfter([
    ...(d.target?.sends ?? []),
    { id: 'preview', date: date || today(), createdAt: new Date().toISOString() },
  ])
  return next ? shortDate(next) : 'None — last one'
}

function PersonRow({ host, draft, onChange }: { host: Host; draft: Draft; onChange: (p: Partial<Draft>) => void }) {
  const { target, contact, logged } = draft
  const name = target ? coldName(target) : draft.name

  let status
  if (logged) status = <span class="badge badge-success">Logged {shortDate(logged.date)}</span>
  else if (contact) status = <span class="badge">A contact</span>
  else if (target) status = <span class="badge">On your list</span>
  else status = <span class="badge">New</span>

  return (
    <div class={`person${draft.selected ? '' : ' is-off'}`}>
      <div class="person-line">
        <input
          type="checkbox"
          class="checkbox"
          checked={draft.selected}
          disabled={Boolean(contact) && !target}
          onChange={(e) => onChange({ selected: e.currentTarget.checked })}
          aria-label={`Log for ${name}`}
        />
        <Avatar name={name} />
        <div class="row-main">
          <div class="hstack" style={{ gap: '6px' }}>
            <span class="row-title truncate">{name}</span>
            {status}
          </div>
          <div class="row-sub truncate">
            {target
              ? [target.role, target.company].filter(Boolean).join(' at ') || draft.person.email
              : draft.person.email}
          </div>
        </div>
      </div>

      {contact && !target && (
        <p class="small muted person-extra">
          {contactName(contact)} is already in your contacts.{' '}
          <button class="link" onClick={() => openUrl(contactUrl(contact.id), host)}>
            Open them
          </button>
        </p>
      )}

      {draft.selected && !target && (
        <div class="person-extra">
          <div class="field">
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
          <div class="grid-2">
            <div>
              <label class="label" for={`c-${draft.key}`}>
                Company
              </label>
              <input
                id={`c-${draft.key}`}
                class="input"
                value={draft.company}
                onInput={(e) => onChange({ company: e.currentTarget.value })}
              />
            </div>
            <div>
              <label class="label" for={`r-${draft.key}`}>
                Role
              </label>
              <input
                id={`r-${draft.key}`}
                class="input"
                value={draft.role}
                placeholder="Optional"
                onInput={(e) => onChange({ role: e.currentTarget.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Logged: when the follow-up is, a way into the page, and a way back. */
function ColdSaved({
  host,
  account,
  results,
  failures,
  onUndone,
}: {
  host: Host
  account: string
  results: Saved[]
  failures: string | null
  onUndone: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function takeBack() {
    setUndoing(true)
    setError(null)
    try {
      for (const r of [...results].reverse()) await r.undo()
      onUndone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t undo that.')
      setUndoing(false)
    }
  }

  const heading =
    results.length === 1
      ? results[0].created
        ? `Added ${coldName(results[0].target)}`
        : `Logged for ${coldName(results[0].target)}`
      : `Logged for ${results.length} people`

  return (
    <Frame
      host={host}
      account={account}
      footer={
        <div class="grid-2">
          <button class="btn btn-secondary" disabled={undoing} aria-busy={undoing} onClick={() => void takeBack()}>
            <Undo size={14} />
            {undoing ? 'Undoing…' : 'Undo'}
          </button>
          <button class="btn btn-primary" onClick={() => host.close()}>
            Done
          </button>
        </div>
      }
    >
      <div class="success-mark">
        <Check size={20} strokeWidth={2.5} />
      </div>
      <h1 class="title">{heading}</h1>
      <p class="lede">On your cold email list in Retrn.</p>

      <div class="panel mt-16">
        {results.map((r) => (
          <button class="row" key={r.target.id} onClick={() => openUrl(coldEmailUrl(r.target.id), host)}>
            <Avatar name={coldName(r.target)} />
            <div class="row-main">
              <div class="row-title truncate">{coldName(r.target)}</div>
              <div class="row-sub">
                {r.target.next_follow_up
                  ? `Follow up ${shortDate(r.target.next_follow_up)}`
                  : r.target.status === 'replied' || r.target.status === 'converted'
                    ? 'Logged — they’ve replied'
                    : 'Logged — that was the last follow-up'}
              </div>
            </div>
            <ArrowUpRight size={14} class="muted" />
          </button>
        ))}
      </div>

      {failures && (
        <div class="mt-12">
          <ErrorNotice>
            <span style={{ whiteSpace: 'pre-line' }}>Not saved — {failures}</span>
          </ErrorNotice>
        </div>
      )}
      {error && (
        <div class="mt-12">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}
    </Frame>
  )
}
