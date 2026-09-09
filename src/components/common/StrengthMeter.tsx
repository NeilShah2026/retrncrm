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
export function StrengthMeter({ value, onChange, size = 'sm', showLabel }: Props) {
  const editable = Boolean(onChange)
  const barH = size === 'sm' ? 'h-3' : 'h-4'
  const barW = size === 'sm' ? 'w-1' : 'w-1.5'
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-end gap-0.5"
        role="img"
        aria-label={`Strength ${value} of 5`}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value
          const bar = (
            <span
              className={cn(
                barW,
                barH,
                'block rounded-[1px] transition-colors duration-fast',
                filled ? 'bg-foreground/80' : 'bg-border',
              )}
            />
          )
          return editable ? (
            <button
              key={n}
              type="button"
              onClick={() => onChange?.(n)}
              className="rounded-sm p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
