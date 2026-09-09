import * as React from 'react'
import { Link } from 'react-router-dom'
import { Tags } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { tagColor } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Contact, Tag } from '@/types'

interface Props {
  contacts: Contact[]
  tags: Tag[]
  limit?: number
}

/**
 * Which corners of the network are actually big.
 *
 * A tag list sorted alphabetically tells you what you've labelled; sorted by
 * size it tells you where your network really is — and the bar makes the
 * lopsidedness obvious at a glance, which is usually the useful part.
 */
export function TopTags({ contacts, tags, limit = 6 }: Props) {
  const ranked = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of contacts) {
      for (const id of c.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return tags
      .map((tag) => ({ tag, count: counts.get(tag.id) ?? 0 }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
      .slice(0, limit)
  }, [contacts, tags, limit])

  const max = ranked[0]?.count ?? 0

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-teal-500" />
            <h2 className="font-semibold">Top tags</h2>
          </div>
          <Link
            to={ROUTES.tags}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Manage
          </Link>
        </div>

        {ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags in use yet. Tag a few people — "fintech", "alumni", "warm
            intro" — and the shape of your network shows up here.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {ranked.map(({ tag, count }) => {
              const c = tagColor(tag.color)
              return (
                <li key={tag.id}>
                  <Link
                    to={ROUTES.contactsSearch(tag.name)}
                    className="group block"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c.dot)} />
                        <span className="truncate text-xs font-medium group-hover:underline">
                          {tag.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', c.dot)}
                        style={{ width: `${max ? (count / max) * 100 : 0}%` }}
                      />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
