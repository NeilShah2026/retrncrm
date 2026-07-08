import { cn } from '@/lib/utils'
import { STRENGTH_LABELS } from '@/lib/constants'

interface Props {
  value: number
  /** Interactive picker (used in forms). */
  onChange?: (value: number) => void
  size?: 'sm' | 'md'
  showLabel?: boolean
}

/** Five-bar relationship-strength meter, optionally editable. */
export function StrengthMeter({
  value,
  onChange,
  size = 'sm',
  showLabel,
}: Props) {
  const editable = Boolean(onChange)
  const barH = size === 'sm' ? 'h-3.5' : 'h-5'
  const barW = size === 'sm' ? 'w-1.5' : 'w-2.5'
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-0.5" role="img" aria-label={`Strength ${value} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value
          const bar = (
            <span
              className={cn(
                barW,
                barH,
                'rounded-sm transition-colors',
                filled ? 'bg-primary' : 'bg-muted',
              )}
              style={{ height: undefined }}
            />
          )
          return editable ? (
            <button
              key={n}
              type="button"
              onClick={() => onChange?.(n === value ? n : n)}
              className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Set strength to ${n}`}
            >
              {bar}
            </button>
          ) : (
            <span key={n}>{bar}</span>
          )
        })}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {STRENGTH_LABELS[value] ?? '—'}
        </span>
      )}
    </div>
  )
}
