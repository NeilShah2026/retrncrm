import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Laptop, Plus, Send } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Playbook } from '@/components/cold-email/Playbook'
import { TargetDetail } from '@/components/cold-email/TargetDetail'
import { TargetFormDialog } from '@/components/cold-email/TargetFormDialog'
import { TargetList } from '@/components/cold-email/TargetList'
import { filterTargets, type ColdFilter } from '@/components/cold-email/filters'
import { useAuth } from '@/auth/AuthProvider'
import { useUI } from '@/context/ui-context'
import { useColdTargets } from '@/hooks/useData'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useMyName } from '@/hooks/useMyName'
import { FREE_COLD_TARGET_LIMIT } from '@/lib/billing/plans'
import { coldStage, useColdEmailAvailable } from '@/lib/coldEmail'
import { readProfile } from '@/lib/shareProfile'
import { cn } from '@/lib/utils'
import type { Sender } from '@/lib/ai/coldEmail'
import type { ColdTarget } from '@/types'

type Tab = 'targets' | 'playbook'

/** Stages that hold one of the free plan's slots — the same set the SQL counts. */
const OPEN = new Set(['drafting', 'sent', 'replied'])

/**
 * Cold email: the people you're writing to but haven't met, the email you're
 * writing each of them, and when to follow up. Laptop only — see
 * `useColdEmailAvailable`.
 *
 * `?target=<id>` selects someone (the Inbox and the extension link here that
 * way) and `?tab=playbook` opens the guide.
 */
export function ColdEmailPage() {
  const available = useColdEmailAvailable()
  if (!available) return <LaptopOnly />
  return <ColdEmail />
}

function ColdEmail() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'playbook' ? 'playbook' : 'targets'
  const targets = useColdTargets()
  const { user } = useAuth()
  const [myName] = useMyName()
  const { isPro } = useEntitlement()
  const { openUpgrade } = useUI()

  const [filter, setFilter] = React.useState<ColdFilter>('all')
  const [query, setQuery] = React.useState('')
  const [adding, setAdding] = React.useState(false)

  const profile = readProfile(user)
  const sender: Sender = React.useMemo(
    () => ({
      name: profile.name || myName,
      school: profile.school || undefined,
      major: profile.major || undefined,
      gradYear: profile.gradYear || undefined,
      headline: profile.headline || undefined,
    }),
    [profile.name, profile.school, profile.major, profile.gradYear, profile.headline, myName],
  )

  const openCount = targets?.filter((t) => OPEN.has(t.status)).length ?? 0
  const due = targets?.filter((t) => coldStage(t) === 'due').length ?? 0
  const atLimit = !isPro && openCount >= FREE_COLD_TARGET_LIMIT

  function setParam(key: 'tab' | 'target', value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        if (key === 'target') next.delete('tab')
        return next
      },
      { replace: true },
    )
  }

  function add() {
    if (atLimit) {
      openUpgrade({ feature: 'coldEmailUnlimited' })
      return
    }
    setAdding(true)
  }

  const header = (
    <PageHeader
      title="Cold email"
      description={
        targets === undefined || targets.length === 0
          ? 'Write to people you haven’t met yet, and follow up until they answer.'
          : [due > 0 && `${due} to follow up`, `${openCount} in progress`].filter(Boolean).join(' · ')
      }
    >
      <div role="group" aria-label="View" className="inline-flex h-8 items-center rounded-md border p-0.5">
        {(
          [
            ['targets', 'People'],
            ['playbook', 'Playbook'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setParam('tab', key === 'targets' ? null : key)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              tab === key ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {key === 'playbook' && <BookOpen className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>
      {!isPro && openCount >= FREE_COLD_TARGET_LIMIT - 3 && (
        <span className="tnum text-xs text-muted-foreground" title="Open cold emails on the free plan">
          {openCount} of {FREE_COLD_TARGET_LIMIT} free
        </span>
      )}
      <Button onClick={add}>
        <Plus />
        Add someone
      </Button>
    </PageHeader>
  )

  return (
    <PageShell width="wide" scrollBody={false} header={header}>
      {tab === 'playbook' ? (
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pt-2 md:-mx-6 md:px-6">
          <Playbook onStart={add} />
        </div>
      ) : (
        <NetworkGate
          data={targets}
          table="cold_targets"
          skeleton={<TwoPaneSkeleton />}
          empty={
            <EmptyState
              variant="first-run"
              icon={Send}
              title="No cold emails yet"
              description="Add someone you want to write to, or log an email you’ve sent from the Chrome extension. New to this? The playbook walks you through your first one."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={add}>
                    <Plus />
                    Add someone
                  </Button>
                  <Button variant="outline" onClick={() => setParam('tab', 'playbook')}>
                    <BookOpen />
                    Read the playbook
                  </Button>
                </div>
              }
            />
          }
        >
          {(all) => (
            <TwoPane
              targets={all}
              selectedParam={params.get('target')}
              onSelect={(id) => setParam('target', id)}
              filter={filter}
              onFilter={setFilter}
              query={query}
              onQuery={setQuery}
              sender={sender}
              profileThin={!profile.school}
            />
          )}
        </NetworkGate>
      )}

      <TargetFormDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={(t) => {
          setFilter('all')
          setQuery('')
          setParam('target', t.id)
        }}
        onLimit={() => openUpgrade({ feature: 'coldEmailUnlimited' })}
      />
    </PageShell>
  )
}

function TwoPane({
  targets,
  selectedParam,
  onSelect,
  filter,
  onFilter,
  query,
  onQuery,
  sender,
  profileThin,
}: {
  targets: ColdTarget[]
  selectedParam: string | null
  onSelect: (id: string | null) => void
  filter: ColdFilter
  onFilter: (f: ColdFilter) => void
  query: string
  onQuery: (q: string) => void
  sender: Sender
  profileThin: boolean
}) {
  const visible = React.useMemo(() => filterTargets(targets, filter, query), [targets, filter, query])
  // A link to someone opens them even when the filter would hide them.
  const selected =
    targets.find((t) => t.id === selectedParam) ?? visible[0] ?? null

  return (
    <div className="mb-5 flex min-h-0 flex-1 overflow-hidden rounded-lg border">
      <div className="w-[22rem] shrink-0 border-r">
        <TargetList
          targets={targets}
          visible={visible}
          selectedId={selected?.id ?? null}
          onSelect={onSelect}
          filter={filter}
          onFilter={onFilter}
          query={query}
          onQuery={onQuery}
        />
      </div>
      <div className="min-w-0 flex-1">
        {selected ? (
          <div className="flex h-full flex-col">
            {profileThin && selected.status !== 'converted' && (
              <p className="border-b bg-bg-sunken/50 px-5 py-2 text-xs text-muted-foreground">
                Drafts introduce you from your profile. Add your school and major under{' '}
                <span className="text-foreground">Share profile</span> in the sidebar so they can say who
                you are.
              </p>
            )}
            <div className="min-h-0 flex-1">
              <TargetDetail
                key={selected.id}
                target={selected}
                sender={sender}
                onDeleted={() => onSelect(null)}
              />
            </div>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Nobody matches. Clear the search or pick another filter.</p>
        )}
      </div>
    </div>
  )
}

function TwoPaneSkeleton() {
  return (
    <div className="mb-5 flex min-h-0 flex-1 overflow-hidden rounded-lg border">
      <div className="w-[22rem] shrink-0 border-r">
        <div className="space-y-2 border-b p-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-7 w-3/4" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b px-3 py-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
      <div className="flex-1 space-y-3 p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    </div>
  )
}

/** Reached on a phone or in the iPhone app — by a link, say. */
function LaptopOnly() {
  return (
    <PageShell mobile={{ title: 'Cold email' }} header={<PageHeader title="Cold email" />}>
      <EmptyState
        icon={Laptop}
        title="Cold email is on your laptop"
        description="Writing, reviewing and following up on cold emails needs a keyboard and room for an editor. Open Retrn on a computer to use it."
      />
    </PageShell>
  )
}
