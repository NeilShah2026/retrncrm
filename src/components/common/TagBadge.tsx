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

/** A tag: dot + name on a muted tint. Tags are one of the few true pills. */
export function TagBadge({ tag, onRemove, onClick, className, active }: Props) {
  const c = tagColor(tag.color)
  const interactive = Boolean(onClick)
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-xs font-medium leading-none',
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
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
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
