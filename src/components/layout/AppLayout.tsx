import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Tag as TagIcon,
  Settings,
  Search,
  Plus,
  KanbanSquare,
  Mail,
  GraduationCap,
  QrCode,
  MoreHorizontal,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from './ThemeToggle'
import { ShareProfileDialog } from '@/components/profile/ShareProfileDialog'
import { useUI } from '@/context/ui-context'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { displayName, initialFor } from '@/lib/displayName'

const PRIMARY_NAV = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: ROUTES.contacts, label: 'Contacts', icon: Users, end: false },
  { to: ROUTES.college, label: 'College', icon: GraduationCap, end: false },
  { to: ROUTES.pipeline, label: 'Pipeline', icon: KanbanSquare, end: false },
]

const SECONDARY_NAV = [
  { to: ROUTES.templates, label: 'Templates', icon: Mail, end: false },
  { to: ROUTES.tags, label: 'Tags', icon: TagIcon, end: false },
  { to: ROUTES.settings, label: 'Settings', icon: Settings, end: false },
]

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
        <Users className="h-4 w-4" />
      </div>
      <span className="text-lg font-semibold tracking-tight">Retrn</span>
    </div>
  )
}

function AccountMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            {initialFor(user)}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {displayName(user)}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(ROUTES.settings)}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  )
}

/**
 * App shell. This owns exactly two things that must never scroll: the
 * sidebar and the mobile chrome (top bar / bottom nav). Everything else — the
 * per-page header and its scrollable body — is each page's own
 * responsibility (see PageShell), so a page can pin its header/table-header
 * and scroll only the region that actually needs it.
 */
export function AppLayout() {
  const { openNewContact, openSearch } = useUI()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [shareOpen, setShareOpen] = React.useState(false)

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop sidebar — fixed, never scrolls */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-hidden border-r bg-card/40 md:flex">
        <div className="px-5 pt-4">
          <Logo />
        </div>

        <div className="mt-5 space-y-2 px-3">
          <Button
            className="w-full justify-start gap-2"
            onClick={openNewContact}
          >
            <Plus className="h-4 w-4" />
            New contact
          </Button>
          <button
            onClick={openSearch}
            className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 px-3">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Toolkit
          </div>
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t px-3 py-3">
          <button
            onClick={() => setShareOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
          >
            <QrCode className="h-4 w-4" />
            Share profile
          </button>
          <AccountMenu />
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] text-muted-foreground">Synced to the cloud</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — fixed, never scrolls */}
        <header className="flex shrink-0 items-center gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openSearch}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button size="icon" onClick={openNewContact} aria-label="New contact">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page outlet — a fixed-height box; each page owns its own header
            (pinned) + scrollable body split via PageShell. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>

        {/* Mobile bottom nav — fixed, never scrolls */}
        <nav className="flex shrink-0 border-t bg-background/95 backdrop-blur md:hidden">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-indigo-500'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-5 w-5" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="mb-1 w-56">
              <DropdownMenuLabel className="truncate font-normal">
                {displayName(user)}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <QrCode className="h-4 w-4" />
                Share profile
              </DropdownMenuItem>
              {SECONDARY_NAV.map((item) => (
                <DropdownMenuItem
                  key={item.to}
                  onClick={() => navigate(item.to)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  )
}
