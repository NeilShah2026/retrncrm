import * as React from 'react'
import { Check, Plus, Tag as TagIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TagBadge } from '@/components/common/TagBadge'
import { useTags } from '@/hooks/useData'
import { tagRepo } from '@/services'
import { TAG_COLOR_KEYS, tagColor } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

/** Multi-select for tags with inline "create new tag" support. */
export function TagSelect({ value, onChange }: Props) {
  const tags = useTags() ?? []
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selected = tags.filter((t) => value.includes(t.id))
  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const exactExists = tags.some(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
  )

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  async function createTag() {
    const name = query.trim()
    if (!name) return
    // Rotate through the palette based on how many tags exist.
    const color = TAG_COLOR_KEYS[tags.length % TAG_COLOR_KEYS.length]
    const created = await tagRepo.create({ name, color })
    onChange([...value, created.id])
    setQuery('')
    toast.success(`Created tag “${name}”`)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((t) => (
          <TagBadge key={t.id} tag={t} onRemove={() => toggle(t.id)} />
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 rounded-full px-2 text-xs"
            >
              <Plus className="h-3 w-3" />
              {selected.length ? 'Add tag' : 'Add tags'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !exactExists && query.trim()) {
                  e.preventDefault()
                  void createTag()
                }
              }}
              placeholder="Search or create…"
              className="h-8"
            />
            <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin">
              {filtered.map((t) => {
                const isSel = value.includes(t.id)
                const c = tagColor(t.color)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                    <span className="flex-1 text-left">{t.name}</span>
                    {isSel && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
              {query.trim() && !exactExists && (
                <button
                  type="button"
                  onClick={() => void createTag()}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  Create “{query.trim()}”
                </button>
              )}
              {!filtered.length && !query.trim() && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  <TagIcon className="mx-auto mb-1 h-4 w-4" />
                  No tags yet. Type to create one.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
