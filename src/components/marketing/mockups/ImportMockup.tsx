import { ArrowRight, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MockAvatar, MockHeader, MockSurface } from './primitives'

/** The sheet's own headers on the left, the Retrn field they became on the right. */
const COLUMNS = [
  { from: 'Name', to: 'Full Name' },
  { from: 'Firm', to: 'Company' },
  { from: 'E-mail', to: 'Email' },
  { from: 'Met at', to: 'Where We Met' },
]

type Status = 'ready' | 'existing' | 'needs-name'

const ROWS: { name: string; company: string; met: string; status: Status }[] = [
  { name: 'Aisha Rahman', company: 'Bain', met: 'Fall career fair', status: 'ready' },
  { name: 'Tom Becker', company: 'HubSpot', met: 'Alumni dinner', status: 'ready' },
  { name: 'Priya Nair', company: 'Figma', met: 'Figma career fair', status: 'existing' },
  { name: '', company: 'Wayfair', met: 'Info session', status: 'needs-name' },
]

const STATUS: Record<Status, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  existing: { label: 'Already in Retrn', className: 'bg-bg-sunken text-text-secondary' },
  'needs-name': { label: 'Needs a name', className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' },
}

/** The spreadsheet import's review step: columns matched, every row checked. */
export function ImportMockup() {
  return (
    <MockSurface className="w-full">
      <div className="flex items-center gap-2.5 border-b px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border bg-bg-sunken text-text-secondary">
          <FileSpreadsheet className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight">networking-spring.xlsx</p>
          <p className="text-[11px] text-muted-foreground">48 rows · 4 columns matched</p>
        </div>
        <span className="flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground">
          Import 46
        </span>
      </div>

      <MockHeader action="Change any of them">Columns</MockHeader>
      <ul className="grid grid-cols-1 gap-x-4 px-3 py-2 sm:grid-cols-2">
        {COLUMNS.map((c) => (
          <li key={c.from} className="flex items-center gap-1.5 py-1 text-[12px]">
            <span className="text-text-secondary">{c.from}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{c.to}</span>
          </li>
        ))}
      </ul>

      <MockHeader action="48 people">Review</MockHeader>
      <ul>
        {ROWS.map((r, i) => (
          <li key={i} className="flex h-9 items-center gap-2 border-b px-3 text-[12px] last:border-b-0">
            {r.name ? (
              <MockAvatar name={r.name} size={20} />
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-full border border-dashed" />
            )}
            <span className={cn('w-24 shrink-0 truncate font-medium', !r.name && 'text-muted-foreground')}>
              {r.name || 'No name'}
            </span>
            <span className="min-w-0 flex-1 truncate text-text-secondary">
              {r.company}
              <span className="hidden text-muted-foreground sm:inline"> · {r.met}</span>
            </span>
            <span
              className={cn(
                'inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[11px] font-medium leading-none',
                STATUS[r.status].className,
              )}
            >
              {STATUS[r.status].label}
            </span>
          </li>
        ))}
      </ul>
    </MockSurface>
  )
}
