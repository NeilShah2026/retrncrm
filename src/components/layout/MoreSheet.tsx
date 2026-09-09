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

/** One row of an inset grouped list: glyph, label, disclosure chevron. */
function Row({
  icon: Icon,
  label,
  onSelect,
  destructive,
  last,
}: {
  icon: typeof Search
  label: string
  onSelect: () => void
  destructive?: boolean
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 pl-3 text-left transition-colors duration-fast active:bg-accent"
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background',
          destructive ? 'text-danger' : 'text-text-secondary',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          'flex flex-1 items-center justify-between py-3 pr-3 text-[17px] leading-tight',
          !last && 'hairline-b',
          destructive && 'text-danger',
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
  return <div className="overflow-hidden rounded-lg border bg-card">{children}</div>
}

/** Everything that doesn't fit on the tab bar, as a bottom sheet. */
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

  function run(action: () => void) {
    onOpenChange(false)
    setTimeout(action, 10)
  }

  const destinations = [
    { icon: GraduationCap, label: 'College', to: ROUTES.college },
    { icon: KanbanSquare, label: 'Pipeline', to: ROUTES.pipeline },
    { icon: Mail, label: 'Templates', to: ROUTES.templates },
    { icon: TagIcon, label: 'Tags', to: ROUTES.tags },
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
        className="gap-0 bg-bg-sunken px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 sm:max-w-sm sm:pt-4"
      >
        <DialogTitle className="sr-only">More</DialogTitle>

        <div className="space-y-4 px-3 pb-2 pt-1">
          <Group>
            <button
              type="button"
              onClick={() => run(() => navigate(ROUTES.settings))}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors duration-fast active:bg-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-sunken text-base font-semibold text-text-secondary">
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
                last={i === destinations.length - 1}
                onSelect={() => run(() => navigate(d.to))}
              />
            ))}
          </Group>

          <Group>
            <Row icon={UserPlus} label="New contact" onSelect={() => run(openNewContact)} />
            <Row icon={Search} label="Search everything" onSelect={() => run(openSearch)} />
            <Row icon={QrCode} label="Share profile" last onSelect={() => run(onShareProfile)} />
          </Group>

          <div className="flex rounded-lg border bg-card p-0.5">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                aria-pressed={theme === t.value}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-colors duration-fast',
                  theme === t.value ? 'bg-accent text-foreground' : 'text-muted-foreground',
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
