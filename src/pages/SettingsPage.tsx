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
  UserX,
  Scale,
  CreditCard,
  LifeBuoy,
  BookUser,
  Bell,
  Sparkles,
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
import { InsetGroup, InsetRow, InsetRowIcon, Switch } from '@/components/ui/inset-list'
import {
  useContacts,
  useFollowUps,
  useKeyDates,
  useOpportunities,
  useTags,
  useTemplates,
} from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useFeatureGate } from '@/hooks/useFeatureGate'
import { useEntitlement } from '@/hooks/useEntitlement'
import { deleteAccount } from '@/lib/deleteAccount'
import { isNative } from '@/lib/platform'
import { ReminderSettingsRow } from '@/components/reminders/ReminderSettingsRow'
import { LEGAL } from '@/pages/legal/legalInfo'
import {
  contactRepo,
  followUpRepo,
  keyDateRepo,
  opportunityRepo,
  tagRepo,
  templateRepo,
} from '@/services'
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
import { isContactLimitError } from '@/lib/billing/contactLimit'
import { isAdmin } from '@/lib/admin'
import {
  analyticsStatus,
  isAnalyticsEnabled,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
  track,
} from '@/lib/analytics'

export function SettingsPage() {
  const { openOnboarding, openImportContacts, openUpgrade } = useUI()
  const gate = useFeatureGate()
  const { user, signOut } = useAuth()
  const { edu, label: planLabel, isPro } = useEntitlement()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const contacts = useContacts() ?? []
  const tags = useTags() ?? []
  const opportunities = useOpportunities() ?? []
  const templates = useTemplates() ?? []
  const followUps = useFollowUps() ?? []
  const keyDates = useKeyDates() ?? []
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [pendingImport, setPendingImport] = React.useState<ParsedImport | null>(null)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [confirmSignOut, setConfirmSignOut] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [eduOpen, setEduOpen] = React.useState(false)
  const [analyticsOff, setAnalyticsOff] = React.useState(isAnalyticsOptedOut)

  function sendTestEvent() {
    const status = analyticsStatus()
    if (!status.configured) {
      toast.error('No PostHog key in this build. Set VITE_POSTHOG_KEY and redeploy.')
      return
    }
    if (status.optedOut) {
      toast.error('Analytics are switched off on this device — turn them on first.')
      return
    }
    track('test_event')
    toast.success('Sent. It shows in PostHog → Activity within a minute.')
  }

  function toggleAnalytics() {
    const next = !analyticsOff
    setAnalyticsOff(next)
    setAnalyticsOptOut(next)
    toast.success(next ? 'Usage analytics turned off' : 'Usage analytics turned on')
  }

  function handleExportJson() {
    if (!gate.require('export')) return
    exportJson(contacts, tags, opportunities, templates, followUps, keyDates)
    toast.success('Exported JSON backup')
  }

  function handleExportCsv() {
    if (!gate.require('export')) return
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
        // Rewriting contacts cascades their follow-ups and dates away; put
        // back the ones in the backup.
        await followUpRepo.insertAll(pendingImport.followUps)
        await keyDateRepo.insertAll(pendingImport.keyDates)
      } else {
        await tagRepo.replaceAll(mergeById(tags, pendingImport.tags))
        await contactRepo.replaceAll(mergeById(contacts, pendingImport.contacts))
        await opportunityRepo.replaceAll(mergeById(opportunities, pendingImport.opportunities))
        await templateRepo.replaceAll(mergeById(templates, pendingImport.templates))
        // Same cascade on a merge: restore what was here plus what came in,
        // for every contact that still exists.
        const kept = new Set(mergeById(contacts, pendingImport.contacts).map((c) => c.id))
        await followUpRepo.insertAll(
          mergeById(followUps, pendingImport.followUps).filter((f) => kept.has(f.contactId)),
        )
        await keyDateRepo.insertAll(
          mergeById(keyDates, pendingImport.keyDates).filter((k) => kept.has(k.contactId)),
        )
      }
      toast.success(`Imported ${pendingImport.contacts.length} contacts (${mode})`)
    } catch (err) {
      if (isContactLimitError(err)) return
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

  /**
   * Permanent account deletion — an App Store requirement (Guideline
   * 5.1.1(v)), not a nicety. The server removes the auth user and every table
   * cascades from it; by the time this resolves the session is gone too, so
   * RequireAuth takes over and lands on the sign-in screen.
   */
  async function handleDeleteAccount() {
    try {
      await deleteAccount()
      toast.success('Your account and all its data have been deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete your account.')
    }
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

        <InsetGroup title="Subscription">
          <InsetRow
            leading={<InsetRowIcon icon={CreditCard} />}
            title="Plan"
            subtitle={isPro ? 'Every paid feature is unlocked' : 'Upgrade for unlimited contacts'}
            detail={planLabel}
            last
            onClick={() => navigate(ROUTES.subscription)}
          />
        </InsetGroup>

        <InsetGroup title="Student">
          <InsetRow
            leading={<InsetRowIcon icon={edu.student ? BadgeCheck : GraduationCap} />}
            title={edu.student ? 'School Email' : 'Verify School Email'}
            subtitle={
              edu.student ? edu.email : 'Unlocks Student pricing · free with @babson.edu'
            }
            detail={edu.verified ? 'Free' : edu.student ? 'Verified' : undefined}
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

        {isAnalyticsEnabled() && (
          <InsetGroup
            title="Privacy"
            footer="Anonymous counts of which features get used — never your contacts, notes or messages. Off applies to this device."
          >
            <InsetRow
              title="Share Usage Analytics"
              role="switch"
              checked={!analyticsOff}
              chevron={false}
              accessory={<Switch checked={!analyticsOff} />}
              last
              onClick={toggleAnalytics}
            />
          </InsetGroup>
        )}

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

        <InsetGroup
          title="Bring people in"
          footer={
            isNative
              ? 'Pick who to add from your iPhone’s Contacts. Their birthdays come too.'
              : 'From a .vcf file exported from iCloud, Google Contacts or Outlook.'
          }
        >
          <InsetRow
            leading={<InsetRowIcon icon={BookUser} />}
            title={isNative ? 'Import from Contacts' : 'Import a Contacts File'}
            last
            onClick={openImportContacts}
          />
        </InsetGroup>

        {isNative && (
          <InsetGroup
            title="Reminders"
            footer="Follow-ups and birthdays arrive as a notification at 9am on the day."
          >
            <ReminderSettingsRow icon={<InsetRowIcon icon={Bell} />} />
          </InsetGroup>
        )}

        <InsetGroup title="Help">
          <InsetRow
            leading={<InsetRowIcon icon={CircleHelp} />}
            title="Run Through Onboarding"
            subtitle="The welcome flow, and re-answer the setup questions"
            onClick={openOnboarding}
          />
          <InsetRow
            leading={<InsetRowIcon icon={LifeBuoy} />}
            title="Contact Support"
            subtitle={LEGAL.emails.hello}
            chevron={false}
            // A location change, not `window.open`: WKWebView drops a popup
            // to a non-http scheme, and Capacitor hands a mailto: navigation
            // to the system mail app.
            onClick={() => {
              window.location.href = `mailto:${LEGAL.emails.hello}`
            }}
          />
          <InsetRow
            leading={<InsetRowIcon icon={ShieldCheck} />}
            title="Privacy Policy"
            onClick={() => navigate(ROUTES.privacy)}
          />
          <InsetRow
            leading={<InsetRowIcon icon={Scale} />}
            title="Terms of Use"
            last
            onClick={() => navigate(ROUTES.terms)}
          />
        </InsetGroup>

        {isAdmin(user) && (
          <InsetGroup title="Testing" footer="Only visible to admins. Buttons in the preview still work.">
            <InsetRow
              leading={<InsetRowIcon icon={Sparkles} />}
              title="Preview Upgrade Popup"
              subtitle="What free accounts see at 30 contacts"
              onClick={() => openUpgrade({ preview: true })}
            />
            <InsetRow
              title="Analytics"
              subtitle={analyticsDetail()}
              detail={analyticsStatus().configured ? 'On' : 'Off'}
              chevron={false}
            />
            <InsetRow
              title="Send Test Event"
              subtitle="Proves the key and the network path"
              chevron={false}
              last
              onClick={sendTestEvent}
            />
          </InsetGroup>
        )}

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

        {/* Deleting the account itself, in a group of its own — it is not a
            bigger version of "clear data", it ends the account. Reachable in
            two taps from the tab bar, as App Store review expects. */}
        <InsetGroup footer="Deletes your account and everything in it, everywhere. This cannot be undone.">
          <InsetRow
            leading={<InsetRowIcon icon={UserX} tone="danger" />}
            title="Delete Account"
            destructive
            chevron={false}
            last
            onClick={() => setConfirmDelete(true)}
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
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.subscription)}>
                  <CreditCard />
                  {isPro ? 'View plan' : 'See plans'}
                </Button>
              }
            >
              Subscription
            </PanelHeader>
            <PanelSection className="text-sm">
              <p className="font-medium">{planLabel}</p>
              <p className="text-muted-foreground">
                {isPro
                  ? 'Every paid feature is unlocked on this account.'
                  : 'Up to 30 contacts and the basics. Upgrade for unlimited contacts, capture and pipeline.'}
              </p>
            </PanelSection>
          </Panel>

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
              </Link>{' '}
              ·{' '}
              <Link to={ROUTES.terms} className="text-brand hover:underline">
                Terms of use
              </Link>
            </PanelSection>
          </Panel>

          {isAnalyticsEnabled() && (
            <Panel>
              <PanelHeader>Privacy</PanelHeader>
              <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">Share usage analytics</p>
                  <p className="text-muted-foreground">
                    Anonymous counts of which features get used, so we know what to improve.
                    Never your contacts, notes or messages. Applies to this device.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAnalytics} className="shrink-0">
                  {analyticsOff ? 'Turn on' : 'Turn off'}
                </Button>
              </PanelSection>
            </Panel>
          )}

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
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Import contacts</p>
                <p className="text-muted-foreground">
                  From a .vcf file exported from iCloud, Google Contacts or Outlook. You pick who to add; birthdays come too.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={openImportContacts} className="shrink-0">
                <BookUser />
                Import
              </Button>
            </PanelSection>
          </Panel>

          <Panel>
            <PanelHeader>Help</PanelHeader>
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Run through onboarding</p>
                <p className="text-muted-foreground">
                  The welcome flow again — including the setup questions, so you can change what
                  Retrn tailored to you.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={openOnboarding} className="shrink-0">
                <CircleHelp />
                Run it
              </Button>
            </PanelSection>
          </Panel>

          {isAdmin(user) && (
            <Panel>
              <PanelHeader>Testing</PanelHeader>
              <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">Upgrade popup</p>
                  <p className="text-muted-foreground">
                    What a free account sees on reaching 30 contacts. Only admins see this; the
                    buttons in the preview still work.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openUpgrade({ preview: true })} className="shrink-0">
                  <Sparkles />
                  Preview
                </Button>
              </PanelSection>
              <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">
                    Analytics · {analyticsStatus().configured ? 'on' : 'off'}
                  </p>
                  <p className="text-muted-foreground">{analyticsDetail()}</p>
                </div>
                <Button variant="outline" size="sm" onClick={sendTestEvent} className="shrink-0">
                  Send test event
                </Button>
              </PanelSection>
            </Panel>
          )}

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
            <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Delete account</p>
                <p className="text-muted-foreground">
                  Ends your account and deletes everything in it, everywhere. This cannot be undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} className="shrink-0">
                <UserX />
                Delete account
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
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your account?"
        description="This permanently deletes your Retrn account and every contact, activity, tag, opportunity and template in it. It cannot be undone, and signing in again will not bring it back. Export a backup first if you want to keep any of it."
        confirmLabel="Delete my account"
        confirmWord="delete"
        destructive
        onConfirm={handleDeleteAccount}
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

/** One line explaining exactly why analytics are, or aren't, running. */
function analyticsDetail(): string {
  const { configured, host, loaded, optedOut } = analyticsStatus()
  if (!configured) return 'No VITE_POSTHOG_KEY in this build — set it in Vercel and redeploy.'
  if (optedOut) return 'Switched off on this device in Settings → Privacy.'
  return `${loaded ? 'Connected to' : 'Connecting to'} ${host.replace('https://', '')}`
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
