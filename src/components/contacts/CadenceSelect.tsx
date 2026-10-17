import * as React from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FREQUENCY_KEYS,
  MAX_FREQUENCY_DAYS,
  frequencyDays,
  frequencyFromDays,
  frequencyLabel,
  isPresetFrequency,
} from '@/lib/constants'
import type { ContactFrequency } from '@/types'
import { cn } from '@/lib/utils'

const CUSTOM = 'custom'

/**
 * The reconnect cadence picker: No goal, every 30 / 45 / 60 / 90 days, or
 * Custom…, which shows a days field beside the dropdown. A contact already on
 * a custom interval (or one carried over from the old presets, like 182
 * days) opens with that number filled in.
 */
export function CadenceSelect({
  value,
  onChange,
  id,
  className,
}: {
  value: ContactFrequency
  onChange: (value: ContactFrequency) => void
  id?: string
  className?: string
}) {
  const [custom, setCustom] = React.useState(() => !isPresetFrequency(value))
  const [draft, setDraft] = React.useState(() => String(frequencyDays(value) ?? ''))

  // A new contact loaded into the same form.
  React.useEffect(() => {
    if (!isPresetFrequency(value)) {
      setCustom(true)
      setDraft(String(frequencyDays(value) ?? ''))
    }
  }, [value])

  function commit(text: string) {
    const days = parseInt(text, 10)
    if (Number.isFinite(days) && days >= 1) onChange(frequencyFromDays(days))
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={custom ? CUSTOM : value}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setCustom(true)
            const days = frequencyDays(value) ?? 30
            setDraft(String(days))
            onChange(frequencyFromDays(days))
            return
          }
          setCustom(false)
          onChange(v as ContactFrequency)
        }}
      >
        <SelectTrigger id={id} className="min-w-0 flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCY_KEYS.map((k) => (
            <SelectItem key={k} value={k}>
              {frequencyLabel(k)}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_FREQUENCY_DAYS}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              commit(e.target.value)
            }}
            aria-label="Days between catch-ups"
            className="h-8 w-20"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}
    </div>
  )
}
