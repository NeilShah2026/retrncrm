import { useEffect, useState } from 'preact/hooks'
import {
  contactName,
  createContact,
  fillContact,
  findContactByLinkedin,
  findContactsByName,
  logInteraction,
  type Contact,
} from '../db'
import type { LinkedInProfileContext } from '../types'
import { lastTouch, splitHeadline, today } from '../ui/format'
import { Avatar, ErrorNotice, Frame, SkeletonRows } from './common'
import type { Host } from './host'
import { Success, type SavedResult } from './Success'

/** Adding someone from their LinkedIn profile, or filling in a contact you already have. */
export function LinkedInScreen({
  host,
  account,
  context,
}: {
  host: Host
  account: string
  context: LinkedInProfileContext
}) {
  const { person } = context
  const parsed = splitHeadline(person.headline)

  const [loaded, setLoaded] = useState(false)
  const [match, setMatch] = useState<Contact | null>(null)
  const [candidates, setCandidates] = useState<Contact[]>([])
  const [target, setTarget] = useState('new')
  const [title, setTitle] = useState(parsed.title)
  const [company, setCompany] = useState(parsed.company)
  const [logTouch, setLogTouch] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedResult | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setLoadError(null)
    void (async () => {
      try {
        const byProfile = person.linkedinUrl ? await findContactByLinkedin(person.linkedinUrl) : null
        const byName = byProfile ? [] : await findContactsByName(person.name)
        if (cancelled) return
        const sameName = byName.filter(
          (c) => !c.linkedin_url && contactName(c).toLowerCase() === person.name.toLowerCase(),
        )
        setMatch(byProfile)
        setCandidates(byName)
        setTarget(byProfile?.id ?? (sameName.length === 1 ? sameName[0].id : 'new'))
        setLoaded(true)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Couldn’t load your contacts.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [person.linkedinUrl, person.name, attempt])

  const existing = match ?? candidates.find((c) => c.id === target) ?? null
  const isNew = target === 'new'

  async function save() {
    setSaving(true)
    setError(null)
    const touch = logTouch
      ? { type: 'linkedin', date: today(), summary: 'Connected on LinkedIn', link: context.link }
      : undefined
    try {
      if (isNew) {
        const { contact, undo } = await createContact(
          { name: person.name, linkedinUrl: person.linkedinUrl, company, jobTitle: title },
          touch,
        )
        setSaved({ contact, undo, created: true })
      } else {
        let contact = await fillContact(target, {
          linkedin_url: person.linkedinUrl,
          company,
          job_title: title,
        })
        // Filled-in details aren't offered for undo; a logged touch is.
        let undoToken: SavedResult['undo']
        if (touch) {
          const logged = await logInteraction(target, touch)
          contact = logged.contact
          undoToken = logged.undo
        }
        setSaved({ contact, undo: undoToken, created: false })
      }
      host.onLogged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <Success
        host={host}
        account={account}
        results={[saved]}
        verb={logTouch ? 'Connection logged' : 'Details saved'}
        onUndone={() => {
          setSaved(null)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }

  const upToDate =
    existing &&
    Boolean(existing.linkedin_url) &&
    (!title || Boolean(existing.job_title)) &&
    (!company || Boolean(existing.company))

  return (
    <Frame
      host={host}
      account={account}
      footer={
        loaded && (
          <>
            {error && (
              <div class="field">
                <ErrorNotice>{error}</ErrorNotice>
              </div>
            )}
            <button
              class="btn btn-primary btn-block"
              disabled={saving || (upToDate && !logTouch) || !person.name}
              aria-busy={saving}
              onClick={() => void save()}
            >
              {saving
                ? 'Saving…'
                : isNew
                  ? 'Add to Retrn'
                  : upToDate && !logTouch
                    ? 'Already up to date'
                    : `Update ${existing ? existing.first_name : 'contact'}`}
            </button>
          </>
        )
      }
    >
      <div class="hstack">
        <Avatar name={person.name} large />
        <div class="row-main">
          <div class="title truncate">{person.name}</div>
          {person.headline && <div class="row-sub clamp-2">{person.headline}</div>}
        </div>
      </div>

      <div class="mt-16">
        {loadError ? (
          <ErrorNotice>
            {loadError}{' '}
            <button class="link" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </ErrorNotice>
        ) : !loaded ? (
          <SkeletonRows count={1} />
        ) : (
          <>
            {match ? (
              <div class="notice">
                <div>
                  <strong>{contactName(match)}</strong> is already in Retrn. {lastTouch(match)}.
                </div>
              </div>
            ) : (
              candidates.length > 0 && (
                <div class="field">
                  <label class="label" for="target">
                    Save to
                  </label>
                  <select id="target" class="select" value={target} onChange={(e) => setTarget(e.currentTarget.value)}>
                    <option value="new">A new contact</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {contactName(c)}
                        {c.company ? ` · ${c.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            <div class="grid-2 field mt-12">
              <div>
                <label class="label" for="title">
                  Title
                </label>
                <input id="title" class="input" value={title} placeholder="Optional" onInput={(e) => setTitle(e.currentTarget.value)} />
              </div>
              <div>
                <label class="label" for="company">
                  Company
                </label>
                <input
                  id="company"
                  class="input"
                  value={company}
                  placeholder="Optional"
                  onInput={(e) => setCompany(e.currentTarget.value)}
                />
              </div>
            </div>
            {!isNew && (
              <p class="small muted field">Only fills in what this contact doesn’t have yet.</p>
            )}
            <label class="check-row">
              <input
                type="checkbox"
                class="checkbox"
                checked={logTouch}
                onChange={(e) => setLogTouch(e.currentTarget.checked)}
              />
              Log that you connected today
            </label>
          </>
        )}
      </div>
    </Frame>
  )
}
