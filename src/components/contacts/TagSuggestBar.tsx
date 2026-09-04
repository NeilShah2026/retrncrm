import * as React from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTags } from '@/hooks/useData'
import { AiUnavailableError, isAiAvailable } from '@/lib/ai/client'
import { hasTaggableDetail, suggestTagsForSubject } from '@/lib/ai/tagging'
import {
  ensureTags,
  suggestTagsLocally,
  type TagSubject,
  type TagSuggestion,
} from '@/lib/tagging'
import { tagColor } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  /** The person as the form currently describes them — unsaved is fine. */
  subject: TagSubject
  /** Currently-selected tag ids. */
  value: string[]
  onChange: (next: string[]) => void
  /**
   * Read the record once, on its own, instead of waiting to be asked.
   * Suggestions still have to be tapped to apply.
   */
  auto?: boolean
  className?: string
}

/** How long the record must stop changing before the one auto-run fires. */
const IDLE_BEFORE_SUGGEST_MS = 1500

/**
 * "Here are the tags this person probably wants."
 *
 * Sits under the tag picker in the contact form. It proposes; the user taps.
 * Nothing here can write a tag onto a contact — applying one only moves the
 * form's own selection, which then gets saved like anything else the user
 * typed.
 *
 * The automatic pass runs at most **once per time the form is opened**, after
 * the record stops changing. That cap is the whole design: a suggestion that
 * re-fires on every pause in typing would spend a request per keystroke burst
 * and yank chips out from under the cursor.
 *
 * With AI unreachable it falls back to `suggestTagsLocally`, which matches the
 * user's existing tags against the record. Fewer suggestions, same
 * interaction, no error to explain.
 */
export function TagSuggestBar({ subject, value, onChange, auto, className }: Props) {
  const tags = useTags() ?? []
  const [suggestions, setSuggestions] = React.useState<TagSuggestion[]>([])
  const [loading, setLoading] = React.useState(false)
  const [applying, setApplying] = React.useState<string | null>(null)
  const [ran, setRan] = React.useState(false)
  const [aiOff, setAiOff] = React.useState(() => !isAiAvailable())

  // `run` has to be stable — anything that re-creates it restarts the idle
  // timer below — so the live values it needs come through refs.
  const latest = React.useRef({ subject, tags, value })
  latest.current = { subject, tags, value }

  const run = React.useCallback(async () => {
    const { subject: s, tags: t, value: v } = latest.current
    setLoading(true)
    try {
      const next = aiOff
        ? suggestTagsLocally(s, t, v)
        : await suggestTagsForSubject(s, t, v)
      setSuggestions(next)
    } catch (err) {
      if (err instanceof AiUnavailableError) setAiOff(true)
      else console.error(err)
      // Whatever went wrong, the rules-based pass still has something to say.
      setSuggestions(suggestTagsLocally(s, t, v))
    } finally {
      setRan(true)
      setLoading(false)
    }
  }, [aiOff])

  // The fields that could change an answer — so filling in a phone number
  // doesn't count as the record changing.
  const fingerprint = [
    subject.company,
    subject.jobTitle,
    subject.industry,
    subject.school,
    subject.major,
    subject.connectionType,
    subject.source,
    subject.whereWeMet,
    subject.howWeMet,
    subject.notes,
  ]
    .map((v) => v ?? '')
    .join('|')

  // One automatic pass per mount (the dialog unmounts this on close, so the
  // next contact gets its own), once the record has settled.
  const autoRan = React.useRef(false)
  React.useEffect(() => {
    if (!auto || autoRan.current) return
    if (!hasTaggableDetail(latest.current.subject)) return
    const timer = setTimeout(() => {
      autoRan.current = true
      void run()
    }, IDLE_BEFORE_SUGGEST_MS)
    return () => clearTimeout(timer)
  }, [auto, fingerprint, run])

  async function apply(suggestion: TagSuggestion) {
    setApplying(suggestion.name)
    try {
      const id =
        suggestion.tagId ?? (await ensureTags([suggestion.name], tags)).ids[0]
      if (id && !value.includes(id)) onChange([...value, id])
      setSuggestions((s) => s.filter((x) => x.name !== suggestion.name))
    } catch (err) {
      console.error(err)
      toast.error('Could not add that tag.')
    } finally {
      setApplying(null)
    }
  }

  async function applyAll() {
    setApplying('*')
    try {
      const { ids } = await ensureTags(
        suggestions.map((s) => s.name),
        tags,
      )
      const merged = [...value]
      for (const id of ids) if (!merged.includes(id)) merged.push(id)
      onChange(merged)
      setSuggestions([])
    } catch (err) {
      console.error(err)
      toast.error('Could not add those tags.')
    } finally {
      setApplying(null)
    }
  }

  const busy = loading || applying !== null
  const empty = ran && suggestions.length === 0

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {suggestions.map((s) => {
        const color = s.tagId
          ? tagColor(tags.find((t) => t.id === s.tagId)?.color ?? 'slate')
          : null
        return (
          <button
            key={s.name}
            type="button"
            disabled={busy}
            onClick={() => void apply(s)}
            title={s.tagId ? `Add “${s.name}”` : `Create and add “${s.name}”`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium transition-opacity disabled:opacity-50',
              color
                ? `${color.badge} border-transparent hover:opacity-80`
                : 'border-indigo-400/60 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10',
            )}
          >
            {applying === s.name ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {s.name}
            {!s.tagId && <span className="opacity-60">new</span>}
          </button>
        )
      })}

      {suggestions.length > 1 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void applyAll()}
          className="h-6 px-2 text-xs"
        >
          {applying === '*' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            `Add all ${suggestions.length}`
          )}
        </Button>
      )}

      {suggestions.length === 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || !hasTaggableDetail(subject)}
          onClick={() => void run()}
          className="h-6 gap-1 px-2 text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {loading ? 'Reading…' : empty ? 'Suggest again' : 'Suggest tags'}
        </Button>
      )}

      {empty && !loading && (
        <span className="text-xs text-muted-foreground">
          Nothing to suggest yet — a company, school, or note is enough to go on.
        </span>
      )}
    </div>
  )
}
