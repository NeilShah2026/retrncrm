import * as React from 'react'
import { Filter, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TagBadge } from '@/components/common/TagBadge'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_KEYS,
  MEET_SOURCES,
  MEET_SOURCE_KEYS,
  STRENGTH_LABELS,
} from '@/lib/constants'
import {
  countActiveFilters,
  distinctValues,
  EMPTY_FILTERS,
  type ContactFilters,
} from '@/lib/filters'
import { cn } from '@/lib/utils'
import type { Contact, Tag } from '@/types'

interface Props {
  contacts: Contact[]
  tags: Tag[]
  filters: ContactFilters
  onChange: (next: ContactFilters) => void
}

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value]
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent/60">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="flex-1 truncate">{children}</span>
    </label>
  )
}

export function FilterPanel({ contacts, tags, filters, onChange }: Props) {
  const [open, setOpen] = React.useState(false)
  const count = countActiveFilters(filters)

  const companies = distinctValues(contacts, 'company')
  const industries = distinctValues(contacts, 'industry')
  const wheres = distinctValues(contacts, 'whereWeMet')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {count > 0 && (
            <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-[calc(100vw-2rem)] overflow-y-auto scrollbar-thin p-3 sm:w-80"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Filters</span>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onChange(EMPTY_FILTERS)}
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>

        {/* Overdue toggle */}
        <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
          <Checkbox
            checked={filters.overdueOnly}
            onCheckedChange={() =>
              onChange({ ...filters, overdueOnly: !filters.overdueOnly })
            }
          />
          <span className="flex-1">Overdue for contact</span>
        </label>

        {tags.length > 0 && (
          <FilterSection label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <TagBadge
                  key={t.id}
                  tag={t}
                  active={filters.tagIds.includes(t.id)}
                  onClick={() =>
                    onChange({ ...filters, tagIds: toggle(filters.tagIds, t.id) })
                  }
                />
              ))}
            </div>
          </FilterSection>
        )}

        <FilterSection label="Connection type">
          <div className="grid grid-cols-2 gap-x-2">
            {CONNECTION_TYPE_KEYS.map((k) => (
              <CheckRow
                key={k}
                checked={filters.connectionTypes.includes(k)}
                onChange={() =>
                  onChange({
                    ...filters,
                    connectionTypes: toggle(filters.connectionTypes, k),
                  })
                }
              >
                {CONNECTION_TYPES[k].emoji} {CONNECTION_TYPES[k].label}
              </CheckRow>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="How you met (source)">
          <div className="grid grid-cols-2 gap-x-2">
            {MEET_SOURCE_KEYS.map((k) => (
              <CheckRow
                key={k}
                checked={filters.sources.includes(k)}
                onChange={() =>
                  onChange({
                    ...filters,
                    sources: toggle(filters.sources, k),
                  })
                }
              >
                {MEET_SOURCES[k].emoji} {MEET_SOURCES[k].label}
              </CheckRow>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Relationship strength">
          <div className="space-y-0.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <CheckRow
                key={n}
                checked={filters.strengths.includes(n)}
                onChange={() =>
                  onChange({
                    ...filters,
                    strengths: toggle(filters.strengths, n),
                  })
                }
              >
                {n} · {STRENGTH_LABELS[n]}
              </CheckRow>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Date met">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.metFrom ?? ''}
              onChange={(e) =>
                onChange({ ...filters, metFrom: e.target.value || undefined })
              }
              className="h-8"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.metTo ?? ''}
              onChange={(e) =>
                onChange({ ...filters, metTo: e.target.value || undefined })
              }
              className="h-8"
            />
          </div>
        </FilterSection>

        {companies.length > 0 && (
          <FilterSection label="Company">
            <ScrollList>
              {companies.map((v) => (
                <CheckRow
                  key={v}
                  checked={filters.companies.includes(v)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      companies: toggle(filters.companies, v),
                    })
                  }
                >
                  {v}
                </CheckRow>
              ))}
            </ScrollList>
          </FilterSection>
        )}

        {industries.length > 0 && (
          <FilterSection label="Industry">
            <ScrollList>
              {industries.map((v) => (
                <CheckRow
                  key={v}
                  checked={filters.industries.includes(v)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      industries: toggle(filters.industries, v),
                    })
                  }
                >
                  {v}
                </CheckRow>
              ))}
            </ScrollList>
          </FilterSection>
        )}

        {wheres.length > 0 && (
          <FilterSection label="Where we met">
            <ScrollList>
              {wheres.map((v) => (
                <CheckRow
                  key={v}
                  checked={filters.whereMet.includes(v)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      whereMet: toggle(filters.whereMet, v),
                    })
                  }
                >
                  {v}
                </CheckRow>
              ))}
            </ScrollList>
          </FilterSection>
        )}
      </PopoverContent>
    </Popover>
  )
}

function FilterSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-3">
      <Separator className="mb-2" />
      <Label className={cn('mb-1.5 block text-xs text-muted-foreground')}>
        {label}
      </Label>
      {children}
    </div>
  )
}

function ScrollList({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-40 overflow-y-auto scrollbar-thin pr-1">
      {children}
    </div>
  )
}
