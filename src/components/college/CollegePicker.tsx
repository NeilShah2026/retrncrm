import * as React from 'react'
import { Check, ChevronsUpDown, GraduationCap, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { US_COLLEGES } from '@/data/usColleges'
import { cn } from '@/lib/utils'

interface Props {
  value?: string
  onSelect: (college: string) => void
  /** Rendered as the trigger when no value is set yet. */
  placeholder?: string
  className?: string
}

const MAX_RESULTS = 60

/**
 * Searchable college combobox over the bundled US college list. Filtering is
 * capped to MAX_RESULTS so the popover never renders thousands of rows, and a
 * free-text row lets a school that isn't on the list be used anyway — so any
 * college works, listed or not.
 */
export function CollegePicker({ value, onSelect, placeholder, className }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return US_COLLEGES.slice(0, MAX_RESULTS)
    const out: string[] = []
    for (const name of US_COLLEGES) {
      if (name.toLowerCase().includes(q)) {
        out.push(name)
        if (out.length >= MAX_RESULTS) break
      }
    }
    return out
  }, [query])

  const trimmed = query.trim()
  const exactMatch = US_COLLEGES.some((c) => c.toLowerCase() === trimmed.toLowerCase())

  function choose(name: string) {
    onSelect(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border bg-background px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-accent',
            className,
          )}
        >
          <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn('flex-1 truncate', !value && 'text-muted-foreground')}>
            {value || placeholder || 'Choose your college…'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 2,300+ colleges…"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin p-1">
          {results.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => choose(name)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <Check
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  value === name ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="truncate">{name}</span>
            </button>
          ))}

          {trimmed && !exactMatch && (
            <button
              type="button"
              onClick={() => choose(trimmed)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              Use “<span className="font-medium text-foreground">{trimmed}</span>”
            </button>
          )}

          {results.length === 0 && !trimmed && (
            <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
              Start typing to search.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
