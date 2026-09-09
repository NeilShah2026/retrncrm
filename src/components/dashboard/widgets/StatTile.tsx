import { Link } from 'react-router-dom'
import type { Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  icon: typeof Users
  label: string
  value: number
  /** Text colour for the icon — the tile's only splash of colour. */
  accent: string
  to?: string
}

/**
 * One number and what it counts. Small enough that four fit across a laptop
 * and two across a phone — and, now that the dashboard is arrangeable, small
 * enough that someone can keep only the number they actually watch.
 */
export function StatTile({ icon: Icon, label, value, accent, to }: Props) {
  const inner = (
    <Card
      className={cn(
        'h-full transition-colors',
        to && 'cursor-pointer hover:border-foreground/20',
      )}
    >
      <CardContent className="flex h-full items-center gap-3 p-4">
        <div className={cn('rounded-lg bg-muted p-2', accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none">{value}</p>
          {/* Wraps rather than truncates: two of these sit side by side on a
              phone, and "Meetings this…" tells you nothing. */}
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
  return to ? (
    <Link to={to} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}
