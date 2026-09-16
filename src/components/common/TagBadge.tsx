import { X } from 'lucide-react'
import { tagColor } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Tag } from '@/types'

interface Props {
  tag: Tag
  onRemove?: () => void
  onClick?: () => void
  className?: string
  active?: boolean
}

/**
 * A tag: its name on its own tint. Tags are one of the few true pills.
 *
 * No dot inside the capsule — the capsule is already the colour, and the two
 * together read as a bullet point stuck to a badge. Bigger on a phone, where
 * an 11px pill next to 17px text looks like a mistake; the desktop's dense
 * tables keep the small one.
 */
export function TagBadge({ tag, onRemove, onClick, className, active }: Props) {
  const c = tagColor(tag.color)
  const interactive = Boolean(onClick)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none',
        'h-6 px-2.5 text-[13px] sm:h-5 sm:px-1.5 sm:text-xs',
        c.badge,
        interactive &&
          'cursor-pointer transition-opacity duration-fast hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active && 'ring-2 ring-brand ring-offset-1 ring-offset-background',
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? active : undefined}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          aria-label={`Remove ${tag.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
