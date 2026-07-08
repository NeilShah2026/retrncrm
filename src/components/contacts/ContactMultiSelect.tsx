import * as React from 'react'
import { Check, Plus, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts } from '@/hooks/useData'
import { fullName } from '@/lib/format'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

/** Multi-select for linking existing contacts (e.g. to an opportunity). */
export function ContactMultiSelect({ value, onChange, placeholder }: Props) {
  const contacts = useContacts() ?? []
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const byId = new Map(contacts.map((c) => [c.id, c]))
  const selected = value.map((id) => byId.get(id)).filter(Boolean)
  const q = query.trim().toLowerCase()
  const filtered = contacts.filter((c) => {
    const hay = `${fullName(c)} ${c.company ?? ''}`.toLowerCase()
    return hay.includes(q)
  })

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(
            (c) =>
              c && (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-1 text-xs"
                >
                  <ContactAvatar contact={c} className="h-5 w-5 text-[9px]" />
                  <span className="max-w-[8rem] truncate">{fullName(c)}</span>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="rounded-full p-0.5 hover:bg-accent"
                    aria-label={`Unlink ${fullName(c)}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ),
          )}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-full px-2 text-xs"
          >
            <Plus className="h-3 w-3" />
            {placeholder ?? 'Link contacts'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="h-8"
          />
          <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent"
              >
                <ContactAvatar contact={c} className="h-6 w-6 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{fullName(c)}</span>
                  {c.company && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.company}
                    </span>
                  )}
                </span>
                {value.includes(c.id) && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No contacts found.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
