import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  GraduationCap,
  KanbanSquare,
  LogOut,
  Mail,
  Moon,
  QrCode,
  Search,
  Settings,
  Sun,
  SunMoon,
  Tag as TagIcon,
  UserPlus,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useUI } from '@/context/ui-context'
import { useAuth } from '@/auth/AuthProvider'
import { useTheme } from '@/components/theme-provider'
import { displayName, initialFor } from '@/lib/displayName'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

/** One row of an inset grouped list: glyph, label, and a disclosure chevron. */
function Row({
  icon: Icon,
  label,
  onSelect,
  tint = 'bg-muted text-foreground',
  destructive,
  last,
}: {
  icon: typeof Search
  label: string
  onSelect: () => void
  /** The rounded glyph tile's colour — iOS settings rows are colour-coded. */
  tint?: string
  destructive?: boolean
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 pl-3 text-left transition-colors active:bg-accent"
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]',
          destructive ? 'bg-destructive/10 text-destructive' : tint,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          'flex flex-1 items-center justify-between py-3 pr-3 text-[17px] leading-tight',
          // The separator starts at the label, not at the card's edge — the
          // detail that makes a grouped list look like a grouped list.
          !last && 'hairline-b',
          destructive && 'text-destructive',
        )}
      >
        {label}
        {!destructive && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        )}
      </span>
    </button>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      {children}
    </div>
  )
}

/**
 * Everything that doesn't fit on the tab bar.
 *
 * A dropdown menu anchored to a tab is a desktop object — it opens upward off
 * a 44pt target and lands wherever it fits. This is the shape a phone expects
 * instead: a sheet from the bottom edge, with the destinations as an inset
 * grouped list under the thumb.
 */
export function MoreSheet({
  open,
  onOpenChange,
  onShareProfile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShareProfile: () => void
}) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { openNewContact, openSearch } = useUI()

  /** Dismiss first, then act — a sheet left hanging over the result is jarring. */
  function run(action: () => void) {
    onOpenChange(false)
    // Let the sheet's exit animation start before the screen underneath moves.
    setTimeout(action, 10)
  }

  const destinations = [
    {
      icon: GraduationCap,
      label: 'College',
      to: ROUTES.college,
      tint: 'bg-indigo-500/15 text-indigo-500',
    },
    {
      icon: KanbanSquare,
      label: 'Pipeline',
      to: ROUTES.pipeline,
      tint: 'bg-violet-500/15 text-violet-500',
    },
    {
      icon: Mail,
      label: 'Templates',
      to: ROUTES.templates,
      tint: 'bg-sky-500/15 text-sky-500',
    },
    {
      icon: TagIcon,
      label: 'Tags',
      to: ROUTES.tags,
      tint: 'bg-amber-500/15 text-amber-500',
    },
  ]

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Auto', icon: SunMoon },
  ] as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className="gap-0 border-0 bg-muted/60 px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 backdrop-blur-xl dark:bg-muted/40 sm:max-w-sm sm:rounded-2xl sm:pt-4"
      >
        <DialogTitle className="sr-only">More</DialogTitle>

        <div className="space-y-4 px-3 pb-2 pt-1">
          <Group>
            <button
              type="button"
              onClick={() => run(() => navigate(ROUTES.settings))}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors active:bg-accent"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-base font-semibold text-indigo-600 dark:text-indigo-400">
                {initialFor(user)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold leading-tight">
                  {displayName(user)}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {user?.email}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          </Group>

          <Group>
            {destinations.map((d, i) => (
              <Row
                key={d.to}
                icon={d.icon}
                label={d.label}
                tint={d.tint}
                last={i === destinations.length - 1}
                onSelect={() => run(() => navigate(d.to))}
              />
            ))}
          </Group>

          <Group>
            <Row
              icon={UserPlus}
              label="New contact"
              tint="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              onSelect={() => run(openNewContact)}
            />
            <Row
              icon={Search}
              label="Search everything"
              tint="bg-muted-foreground/15 text-foreground"
              onSelect={() => run(openSearch)}
            />
            <Row
              icon={QrCode}
              label="Share profile"
              tint="bg-indigo-500/15 text-indigo-500"
              last
              onSelect={() => run(onShareProfile)}
            />
          </Group>

          {/* Appearance, as a segmented control — three taps' worth of choice
              doesn't deserve a menu of its own. */}
          <div className="flex rounded-xl bg-card p-1 ring-1 ring-border">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                aria-pressed={theme === t.value}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 text-[13px] font-medium transition-colors',
                  theme === t.value
                    ? 'bg-accent text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <Group>
            <Row
              icon={Settings}
              label="Settings & data"
              tint="bg-muted-foreground/15 text-foreground"
              onSelect={() => run(() => navigate(ROUTES.settings))}
            />
            <Row
              icon={LogOut}
              label="Sign out"
              destructive
              last
              onSelect={() => run(() => void signOut())}
            />
          </Group>
        </div>
      </DialogContent>
    </Dialog>
  )
}
