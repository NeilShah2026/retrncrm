import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  GraduationCap,
  KanbanSquare,
  Mail,
  QrCode,
  Search,
  Settings,
  Tag as TagIcon,
  UserPlus,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/common/PageHeader'
import { InsetGroup, InsetRow, SegmentedControl } from '@/components/ui/inset-list'
import { useContacts, useOpportunities, useTags, useTemplates } from '@/hooks/useData'
import { useUI } from '@/context/ui-context'
import { useAuth } from '@/auth/AuthProvider'
import { useTheme, type Theme } from '@/components/theme-provider'
import { tapFeedback } from '@/lib/haptics'
import { displayName, initialFor } from '@/lib/displayName'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Automatic' },
]

/**
 * Everything that doesn't fit on the tab bar.
 *
 * Not a second Settings screen: who you are and what your network holds at
 * the top, the three things people come here to *do* as tiles, then the
 * places they go — each carrying the number it holds, so the page says
 * something rather than listing nine identical rows.
 *
 * A screen, not a sheet. UIKit's own More tab pushes a list you can navigate
 * into and back out of, and that is the right shape here too: a sheet has to
 * be dismissed before you can go anywhere, can't be linked to, and puts a
 * modal in the middle of what is really just navigation.
 */
export function MorePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { openNewContact, openSearch } = useUI()

  const contacts = useContacts()
  const tags = useTags()
  const opportunities = useOpportunities()
  const templates = useTemplates()
  const college = (user?.user_metadata?.college as string | undefined)?.trim()

  const destinations = [
    { icon: GraduationCap, label: 'College', to: ROUTES.college, detail: college },
    { icon: KanbanSquare, label: 'Pipeline', to: ROUTES.pipeline, detail: count(opportunities) },
    { icon: Mail, label: 'Templates', to: ROUTES.templates, detail: count(templates) },
    { icon: TagIcon, label: 'Tags', to: ROUTES.tags, detail: count(tags) },
  ]

  return (
    <PageShell
      mobile={{ title: 'More' }}
      header={<PageHeader title="More" description="Everything else in Retrn." />}
      bodyClassName="bg-grouped"
    >
      <div className="space-y-7 pb-2 md:max-w-lg">
        {/* Who you are, and what your network adds up to. */}
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            navigate(ROUTES.settings)
          }}
          className="press-scale block w-full rounded-[14px] bg-grouped-cell p-4 text-left"
        >
          <span className="flex items-center gap-3.5">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-[21px] font-semibold text-text-secondary">
              {initialFor(user)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ios-title3 block truncate">{displayName(user)}</span>
              <span className="text-ios-footnote block truncate text-muted-foreground">
                {user?.email}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/45" />
          </span>
          <span className="text-ios-footnote mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-muted-foreground">
            {/* Contacts always; the rest only once there are any, so the card
                never opens on a row of zeroes. */}
            <Stat n={contacts?.length} label="contacts" />
            {Boolean(tags?.length) && <Stat n={tags?.length} label="tags" />}
            {Boolean(opportunities?.length) && (
              <Stat n={opportunities?.length} label="opportunities" />
            )}
            {Boolean(templates?.length) && <Stat n={templates?.length} label="templates" />}
          </span>
        </button>

        <div className="grid grid-cols-3 gap-2.5">
          <ActionTile icon={UserPlus} label="New contact" onClick={openNewContact} />
          <ActionTile icon={Search} label="Search" onClick={openSearch} />
          <ActionTile icon={QrCode} label="QR code" onClick={() => navigate(ROUTES.qr)} />
        </div>

        <InsetGroup>
          {destinations.map((d, i) => (
            <InsetRow
              key={d.to}
              leading={<d.icon className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.9} />}
              title={d.label}
              detail={d.detail}
              last={i === destinations.length - 1}
              onClick={() => navigate(d.to)}
            />
          ))}
        </InsetGroup>

        <InsetGroup title="Appearance" footer="Automatic follows your phone's light and dark setting.">
          <div className="p-3">
            <SegmentedControl label="Appearance" value={theme} onChange={setTheme} options={THEMES} />
          </div>
        </InsetGroup>

        <InsetGroup>
          <InsetRow
            leading={<Settings className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.9} />}
            title="Settings & Data"
            subtitle="Profile, backup, privacy, sign out"
            last
            onClick={() => navigate(ROUTES.settings)}
          />
        </InsetGroup>
      </div>
    </PageShell>
  )
}

/** One of the three things people open this page to do. */
function ActionTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Search
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onClick()
      }}
      className={cn(
        'press-scale flex h-[86px] flex-col items-center justify-center gap-2 rounded-[14px] bg-grouped-cell px-2',
      )}
    >
      <Icon className="h-[22px] w-[22px] text-foreground/75" strokeWidth={1.9} />
      <span className="text-ios-footnote text-center leading-tight text-text-secondary">{label}</span>
    </button>
  )
}

/** A count that stays quiet until it has loaded. */
function Stat({ n, label }: { n?: number; label: string }) {
  return (
    <span className="tnum">
      <span className="font-semibold text-foreground">{n ?? '—'}</span> {label}
    </span>
  )
}

/** Row detail: a number, but nothing at all when there's none to show. */
function count(rows: unknown[] | undefined): string | undefined {
  return rows && rows.length > 0 ? String(rows.length) : undefined
}
