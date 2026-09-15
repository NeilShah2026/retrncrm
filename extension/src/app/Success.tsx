import { useState } from 'preact/hooks'
import { contactUrl } from '../config'
import { contactName, undo, type Contact, type UndoToken } from '../db'
import { ArrowUpRight, Check, Undo } from '../ui/icons'
import { Avatar, ErrorNotice, Frame } from './common'
import { openUrl, type Host } from './host'

export interface SavedResult {
  contact: Contact
  /** Absent when nothing reversible happened (details filled in, nothing logged). */
  undo?: UndoToken
  created: boolean
}

/** What was saved, with a way back into Retrn and a way to take it back. */
export function Success({
  host,
  account,
  results,
  verb,
  failures,
  onUndone,
}: {
  host: Host
  account: string
  results: SavedResult[]
  /** "Email logged", "Saved" — what happened to each person. */
  verb: string
  failures?: string | null
  onUndone: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const heading =
    results.length === 1 ? `Saved to ${contactName(results[0].contact)}` : `Saved to ${results.length} people`

  async function takeBack() {
    setUndoing(true)
    setError(null)
    try {
      // Newest first, so a contact created in this batch is removed last.
      for (const r of [...results].reverse()) if (r.undo) await undo(r.undo)
      host.onLogged?.()
      onUndone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t undo that.')
      setUndoing(false)
    }
  }

  return (
    <Frame
      host={host}
      account={account}
      footer={
        results.some((r) => r.undo) ? (
          <div class="grid-2">
            <button class="btn btn-secondary" disabled={undoing} aria-busy={undoing} onClick={() => void takeBack()}>
              <Undo size={14} />
              {undoing ? 'Undoing…' : 'Undo'}
            </button>
            <button class="btn btn-primary" onClick={() => host.close()}>
              Done
            </button>
          </div>
        ) : (
          <button class="btn btn-primary btn-block" onClick={() => host.close()}>
            Done
          </button>
        )
      }
    >
      <div class="success-mark">
        <Check size={20} strokeWidth={2.5} />
      </div>
      <h1 class="title">{heading}</h1>
      <p class="lede">It’s on their timeline in Retrn.</p>

      <div class="panel mt-16">
        {results.map((r) => (
          <button class="row" key={r.contact.id} onClick={() => openUrl(contactUrl(r.contact.id), host)}>
            <Avatar name={contactName(r.contact)} />
            <div class="row-main">
              <div class="row-title truncate">{contactName(r.contact)}</div>
              <div class="row-sub">{r.created ? `Added to Retrn · ${verb.toLowerCase()}` : verb}</div>
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
