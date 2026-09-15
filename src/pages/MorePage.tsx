import { useNavigate } from 'react-router-dom'
import {
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
import * as React from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/common/PageHeader'
import { InsetGroup, InsetRow, InsetRowIcon } from '@/components/ui/inset-list'
import { ShareProfileDialog } from '@/components/profile/ShareProfileDialog'
import { useUI } from '@/context/ui-context'
import { useAuth } from '@/auth/AuthProvider'
import { useTheme } from '@/components/theme-provider'
import { tapFeedback } from '@/lib/haptics'
import { displayName, initialFor } from '@/lib/displayName'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

const DESTINATIONS = [
  { icon: GraduationCap, label: 'College', to: ROUTES.college },
  { icon: KanbanSquare, label: 'Pipeline', to: ROUTES.pipeline },
  { icon: Mail, label: 'Templates', to: ROUTES.templates },
  { icon: TagIcon, label: 'Tags', to: ROUTES.tags },
]

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: SunMoon },
] as const

/**
 * Everything that doesn't fit on the tab bar.
 *
 * A screen, not a sheet. UIKit's own More tab pushes a list you can navigate
 * into and back out of, and that is the right shape here too: a sheet has to
 * be dismissed before you can go anywhere, can't be linked to, and puts a
 * modal in the middle of what is really just navigation.
 */
export function MorePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { openNewContact, openSearch } = useUI()
  const [shareOpen, setShareOpen] = React.useState(false)

  return (
    <PageShell
      mobile={{ title: 'More' }}
      header={<PageHeader title="More" description="Everything else in Retrn." />}
      bodyClassName="bg-bg-sunken"
    >
      <div className="space-y-6 md:max-w-lg">
        <InsetGroup>
          <InsetRow
            leading={
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-sunken text-[17px] font-semibold text-text-secondary">
                {initialFor(user)}
              </span>
            }
            title={displayName(user)}
            subtitle={user?.email}
            last
            onClick={() => navigate(ROUTES.settings)}
          />
        </InsetGroup>

        <InsetGroup>
          {DESTINATIONS.map((d, i) => (
            <InsetRow
              key={d.to}
              leading={<InsetRowIcon icon={d.icon} />}
              title={d.label}
              last={i === DESTINATIONS.length - 1}
              onClick={() => navigate(d.to)}
            />
          ))}
        </InsetGroup>

        <InsetGroup>
          <InsetRow
            leading={<InsetRowIcon icon={UserPlus} />}
            title="New contact"
            onClick={openNewContact}
          />
          <InsetRow
            leading={<InsetRowIcon icon={Search} />}
            title="Search everything"
            onClick={openSearch}
          />
          <InsetRow
            leading={<InsetRowIcon icon={QrCode} />}
            title="Share profile"
            last
            onClick={() => setShareOpen(true)}
          />
        </InsetGroup>

        <InsetGroup title="Appearance">
          <div className="flex gap-1 p-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  tapFeedback()
                  setTheme(t.value)
                }}
                aria-pressed={theme === t.value}
                className={cn(
                  'text-ios-footnote flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 font-medium transition-colors duration-fast',
                  theme === t.value
                    ? 'bg-brand/10 text-brand'
                    : 'text-muted-foreground',
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </InsetGroup>

        <InsetGroup>
          <InsetRow
            leading={<InsetRowIcon icon={Settings} />}
            title="Settings & data"
            onClick={() => navigate(ROUTES.settings)}
          />
          <InsetRow
            leading={<InsetRowIcon icon={LogOut} tone="danger" />}
            title="Sign out"
            destructive
            chevron={false}
            last
            onClick={() => void signOut()}
          />
        </InsetGroup>
      </div>

      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
    </PageShell>
  )
}
