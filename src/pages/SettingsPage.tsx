import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Upload,
  BadgeCheck,
  FileJson,
  FileSpreadsheet,
  GraduationCap,
  QrCode,
  Trash2,
  RotateCcw,
  CircleHelp,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BackBarButton } from '@/components/layout/MobileNavBar'
import { Panel, PanelHeader, PanelSection } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InsetGroup, InsetRow, InsetRowIcon } from '@/components/ui/inset-list'
import { useContacts, useOpportunities, useTags, useTemplates } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useEntitlement } from '@/hooks/useEntitlement'
import { contactRepo, opportunityRepo, tagRepo, templateRepo } from '@/services'
import { ShareableProfileCard } from '@/components/profile/ShareableProfileCard'
import { ProfileSheet } from '@/components/profile/ProfileSheet'
import { EduVerificationCard } from '@/components/settings/EduVerificationCard'
import { EduVerificationSheet } from '@/components/settings/EduVerificationSheet'
import { useAuth } from '@/auth/AuthProvider'
import { useUI } from '@/context/ui-context'
import { buildStarterContent } from '@/lib/starterContent'
import { displayName, initialFor } from '@/lib/displayName'
import { exportCsv, exportJson, parseImportBundle, type ParsedImport } from '@/lib/exchange'
import { ROUTES } from '@/lib/routes'
import { toast } from 'sonner'

export function SettingsPage() {
  const { openWelcomeTour } = useUI()
  const { user, signOut } = useAuth()
  const { edu } = useEntitlement()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const contacts = useContacts() ?? []
  const tags = useTags() ?? []
  const opportunities = useOpportunities() ?? []
  const templates = useTemplates() ?? []
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [pendingImport, setPendingImport] = React.useState<ParsedImport | null>(null)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [confirmSignOut, setConfirmSignOut] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [eduOpen, setEduOpen] = React.useState(false)

  function handleExportJson() {
    exportJson(contacts, tags, opportunities, templates)
    toast.success('Exported JSON backup')
  }

  function handleExportCsv() {
    if (contacts.length === 0) {
      toast.error('No contacts to export.')
      return
    }
    exportCsv(contacts, tags)
    toast.success('Exported contacts as CSV')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setPendingImport(parseImportBundle(reader.result as string))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import failed.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function doImport(mode: 'merge' | 'replace') {
    if (!pendingImport) return
    try {
      if (mode === 'replace') {
        await tagRepo.replaceAll(pendingImport.tags)
        await contactRepo.replaceAll(pendingImport.contacts)
        await opportunityRepo.replaceAll(pendingImport.opportunities)
        await templateRepo.replaceAll(pendingImport.templates)
      } else {
        await tagRepo.replaceAll(mergeById(tags, pendingImport.tags))
        await contactRepo.replaceAll(mergeById(contacts, pendingImport.contacts))
        await opportunityRepo.replaceAll(mergeById(opportunities, pendingImport.opportunities))
        await templateRepo.replaceAll(mergeById(templates, pendingImport.templates))
      }
      toast.success(`Imported ${pendingImport.contacts.length} contacts (${mode})`)
    } catch (err) {
      console.error(err)
      toast.error('Import failed while writing data.')
    } finally {
      setPendingImport(null)
    }
  }

  async function handleClear() {
    await Promise.all([contactRepo.clear(), tagRepo.clear(), opportunityRepo.clear(), templateRepo.clear()])
    toast.success('All data cleared')
  }

  async function handleReset() {
    await Promise.all([contactRepo.clear(), tagRepo.clear(), opportunityRepo.clear(), templateRepo.clear()])
    const content = buildStarterContent()
    for (const tag of content.tags) await tagRepo.create({ name: tag.name, color: tag.color })
    for (const contact of content.contacts) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = contact
      await contactRepo.create(draft)
    }
    for (const template of content.templates) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = template
      await templateRepo.create(draft)
    }
    toast.success('Restored starter content')
  }

  const interactions = contacts.reduce((n, c) => n + c.interactions.length, 0)

  /**
   * The phone's Settings: grouped rows on a recessed ground, with anything
   * that needs a form — the shareable profile, school verification — behind a
   * sheet rather than inlined as a panel of web fields.
   */
  function renderPhone() {
    return (
      <div className="space-y-8 pb-2">
        <InsetGroup>
          <InsetRow
            leading={
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06] text-[22px] font-semibold text-text-secondary">
                {initialFor(user)}
              </span>
            }
            title={<span className="text-ios-title3">{displayName(user)}</span>}
            subtitle={user?.email}
            chevron={false}
            last
          />
        </InsetGroup>

        <InsetGroup title="Shareable profile" footer="What people get when they scan your QR code.">
          <InsetRow
            leading={<InsetRowIcon icon={UserRound} />}
            title="Edit Profile"
            onClick={() => setProfileOpen(true)}
          />
          <InsetRow
            leading={<InsetRowIcon icon={QrCode} />}
            title="QR Code"
            subtitle="Show yours, or scan someone else's"
            last
            onClick={() => navigate(ROUTES.qr)}
          />
        </InsetGroup>

        <InsetGroup title="Babson">
          <InsetRow
            leading={<InsetRowIcon icon={edu.verified ? BadgeCheck : GraduationCap} />}
            title={edu.verified ? 'Babson Student' : 'Verify School Email'}
            subtitle={edu.verified ? edu.email : 'Free with an @babson.edu address'}
            detail={edu.verified ? 'Free' : undefined}
            last
            onClick={() => setEduOpen(true)}
          />
        </InsetGroup>

        <InsetGroup
          title="Your data"
          footer={
            <>
              Stored in your own account, readable only by you.{' '}
              <Link to={ROUTES.privacy} className="text-brand">
                Privacy policy
              </Link>
            </>
          }
        >
          <InsetRow title="Contacts" detail={contacts.length} chevron={false} />
          <InsetRow title="Activities" detail={interactions} chevron={false} />
          <InsetRow title="Tags" detail={tags.length} chevron={false} />
          <InsetRow title="Opportunities" detail={opportunities.length} chevron={false} />
          <InsetRow title="Templates" detail={templates.length} chevron={false} last />
        </InsetGroup>

        <InsetGroup
          title="Backup"
          footer="JSON is a full backup you can re-import. CSV opens in any spreadsheet."
        >
          <InsetRow
            leading={<InsetRowIcon icon={FileJson} />}
            title="Export JSON Backup"
            chevron={false}
            onClick={handleExportJson}
          />
          <InsetRow
            leading={<InsetRowIcon icon={FileSpreadsheet} />}
            title="Export Contacts as CSV"
            chevron={false}
            onClick={handleExportCsv}
          />
          <InsetRow
            leading={<InsetRowIcon icon={Upload} />}
            title="Import from Backup"
            last
            onClick={() => fileRef.current?.click()}
          />
        </InsetGroup>

        <InsetGroup title="Help">
          <InsetRow
            leading={<InsetRowIcon icon={CircleHelp} />}
            title="Replay the Tour"
            onClick={openWelcomeTour}
          />
          <InsetRow
            leading={<InsetRowIcon icon={ShieldCheck} />}
            title="Privacy Policy"
            last
            onClick={() => navigate(ROUTES.privacy)}
          />
        </InsetGroup>

        <InsetGroup footer="Neither can be undone — export a backup first.">
          <InsetRow
            leading={<InsetRowIcon icon={RotateCcw} tone="danger" />}
            title="Restore Starter Content"
            destructive
            chevron={false}
            onClick={() => setConfirmReset(true)}
          />
          <InsetRow
            leading={<InsetRowIcon icon={Trash2} tone="danger" />}
            title="Clear All Data"
            destructive
            chevron={false}
            last
            onClick={() => setConfirmClear(true)}
          />
        </InsetGroup>

        <InsetGroup>
          <InsetRow
            title="Sign Out"
            destructive
            centered
            last
            onClick={() => setConfirmSignOut(true)}
          />
        </InsetGroup>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />

        <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
        <EduVerificationSheet open={eduOpen} onOpenChange={setEduOpen} />
      </div>
    )
  }

  return (
    <PageShell
      mobile={{ title: 'Settings', leading: <BackBarButton label="More" /> }}
      bodyClassName={isMobile ? 'bg-grouped' : undefined}
      header={
        <PageHeader
          title="Settings & data"
          description="Your data is private to your account. Back it up or move it any time."
        />
      }
    >
      {isMobile ? (
        renderPhone()
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <ShareableProfileCard />

          <EduVerificationCard />

          <Panel>
            <PanelHeader
              action={
                <Button variant="outline" size="sm" onClick={() => setConfirmSignOut(true)}>
                  <LogOut />
                  Sign out
                </Button>
              }
            >
              Account
            </PanelHeader>
            <PanelSection className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-sm">
              <span className="text-muted-foreground">
                Signed in as <span className="text-foreground">{user?.email}</span>
              </span>
              <dl className="tnum flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Stat n={contacts.length} label="contacts" />
                <Stat n={interactions} label="activities" />
                <Stat n={tags.length} label="tags" />
                <Stat n={opportunities.length} label="opportunities" />
                <Stat n={templates.length} label="templates" />
              </dl>
            </PanelSection>
            <PanelSection className="text-xs text-muted-foreground">
              Stored in your own account, readable only by you.{' '}
              <Link to={ROUTES.privacy} className="text-brand hover:underline">
                Privacy policy
              </Link>
            </PanelSection>
          </Panel>

          <Panel>
            <PanelHeader>Backup</PanelHeader>
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Export</p>
                <p className="text-muted-foreground">JSON is a full backup you can re-import. CSV opens in any spreadsheet.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={handleExportJson}>
                  <FileJson />
                  JSON
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <FileSpreadsheet />
                  CSV
                </Button>
              </div>
            </PanelSection>
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Import</p>
                <p className="text-muted-foreground">Restore from a JSON backup. You choose merge or replace next.</p>
              </div>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="shrink-0">
                <Upload />
                Choose file
              </Button>
            </PanelSection>
          </Panel>

          <Panel>
            <PanelHeader>Help</PanelHeader>
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">New here, or want a refresher on how Retrn fits together?</p>
              <Button variant="outline" size="sm" onClick={openWelcomeTour} className="shrink-0">
                <CircleHelp />
                Replay the tour
              </Button>
            </PanelSection>
          </Panel>

          <Panel className="border-danger/40">
            <PanelHeader className="text-danger">Danger zone</PanelHeader>
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Restore starter content</p>
                <p className="text-muted-foreground">Replaces everything with the example contact and starter templates.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} className="shrink-0">
                <RotateCcw />
                Restore
              </Button>
            </PanelSection>
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Clear all data</p>
                <p className="text-muted-foreground">Deletes every contact, activity, tag, opportunity and template. Export first.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)} className="shrink-0">
                <Trash2 />
                Clear everything
              </Button>
            </PanelSection>
          </Panel>
        </div>
      )}

      <Dialog open={Boolean(pendingImport)} onOpenChange={(o) => !o && setPendingImport(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import data</DialogTitle>
            <DialogDescription>
              {pendingImport
                ? `Found ${pendingImport.contacts.length} contacts and ${pendingImport.tags.length} tags in this file. Merge adds them to what you have; Replace overwrites everything.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void doImport('replace')}>
              Replace all
            </Button>
            <Button onClick={() => void doImport('merge')}>Merge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all data?"
        description="This permanently deletes every contact, activity, tag, opportunity and template in your account. Export a backup first if you want to keep any of it."
        confirmLabel="Clear everything"
        confirmWord="delete"
        destructive
        onConfirm={handleClear}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restore starter content?"
        description="This replaces your current data with the example contact and starter templates. Your existing contacts will be removed."
        confirmLabel="Restore"
        confirmWord="restore"
        destructive
        onConfirm={handleReset}
      />
      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out?"
        description="You’ll need to sign back in to see your network again."
        confirmLabel="Sign out"
        onConfirm={() => void signOut()}
      />
    </PageShell>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-medium text-foreground">{n}</span> {label}
    </span>
  )
}

/** Merge two lists of records, preferring incoming items on id collision. */
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of current) map.set(item.id, item)
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}
