import { useEffect, useState } from 'preact/hooks'
import { APP_ORIGIN, contactUrl } from '../config'
import { contactName, searchContacts, type Contact } from '../db'
import { lastTouch, overdueBy } from '../ui/format'
import { Copy, ExternalLink, Search } from '../ui/icons'
import { Avatar, ErrorNotice, Frame, SkeletonRows } from './common'
import { openUrl, type Host } from './host'

const MAIL_HOSTS = /mail\.google\.com|outlook\.(office|office365|live)\.com|outlook\.cloud\.microsoft/
const LINKEDIN_HOST = /(^|\.)linkedin\.com$/

/**
 * Nothing to log on this page: find someone in your network instead, and a
 * pointer to where the extension does its work.
 */
export function HomeScreen({ host, account, pageHost }: { host: Host; account: string; pageHost: string | null }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Contact[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(
      () => {
        searchContacts(query)
          .then((found) => {
            if (!cancelled) {
              setResults(found)
              setError(null)
            }
          })
          .catch((err) => {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed.')
          })
      },
      query ? 180 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const onMail = pageHost ? MAIL_HOSTS.test(pageHost) : false
  const onLinkedIn = pageHost ? LINKEDIN_HOST.test(pageHost) : false

  async function copyDetails() {
    const details = await host.describePage()
    await navigator.clipboard.writeText(JSON.stringify(details, null, 2))
    setCopied(true)
  }

  return (
    <Frame
      host={host}
      account={account}
      footer={
        <button class="btn btn-secondary btn-block" onClick={() => openUrl(`${APP_ORIGIN}/app`, host)}>
          Open Retrn
          <ExternalLink size={14} />
        </button>
      }
    >
      {(onMail || onLinkedIn) && (
        <div class="notice field">
          <div>
            {onMail
              ? 'Open an email to log it. A Retrn button appears next to the subject.'
              : 'Open a profile or a conversation to save that person.'}
            <div class="mt-8">
              <button class="link small hstack" style={{ gap: '4px' }} onClick={() => void copyDetails()}>
                <Copy size={12} />
                {copied ? 'Copied — send it to Retrn support' : 'Email open but not detected? Copy page details'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div class="search">
        <Search size={14} />
        <input
          class="input"
          type="search"
          placeholder="Search your contacts"
          aria-label="Search your contacts"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autoFocus
        />
      </div>

      <p class="section-label">{query ? 'Results' : 'Recently in touch'}</p>
      {error ? (
        <ErrorNotice>{error}</ErrorNotice>
      ) : !results ? (
        <SkeletonRows count={4} />
      ) : results.length === 0 ? (
        <p class="muted">
          {query ? `No contacts match “${query}”.` : 'No contacts yet. Log an email from Gmail or Outlook to add your first.'}
        </p>
      ) : (
        <div class="panel">
          {results.map((c) => {
            const over = overdueBy(c)
            return (
              <button class="row" key={c.id} onClick={() => openUrl(contactUrl(c.id), host)}>
                <Avatar name={contactName(c)} />
                <div class="row-main">
                  <div class="row-title truncate">{contactName(c)}</div>
                  <div class="row-sub truncate">
                    {[c.company, lastTouch(c)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {over && <span class="badge badge-warning">Overdue</span>}
              </button>
            )
          })}
        </div>
      )}

      {!onMail && !onLinkedIn && (
        <p class="small muted mt-16">
          Retrn logs emails from Gmail and Outlook and saves people from LinkedIn. Open one of those
          and click the Retrn button.
        </p>
      )}
    </Frame>
  )
}
