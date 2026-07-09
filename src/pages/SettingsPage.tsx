import * as React from 'react'
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  Database,
  ShieldCheck,
  Sparkles,
  LogOut,
  UserCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  useContacts,
  useOpportunities,
  useTags,
  useTemplates,
} from '@/hooks/useData'
import { contactRepo, opportunityRepo, tagRepo, templateRepo } from '@/services'
import { ShareableProfileCard } from '@/components/profile/ShareableProfileCard'
import { useAuth } from '@/auth/AuthProvider'
import { useUI } from '@/context/ui-context'
import { buildStarterContent } from '@/lib/starterContent'
import {
  exportCsv,
  exportJson,
  parseImportBundle,
  type ParsedImport,
} from '@/lib/exchange'
import { toast } from 'sonner'

export function SettingsPage() {
  const { openWelcomeTour } = useUI()
  const { user, signOut } = useAuth()
  const contacts = useContacts() ?? []
  const tags = useTags() ?? []
  const opportunities = useOpportunities() ?? []
  const templates = useTemplates() ?? []
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [pendingImport, setPendingImport] = React.useState<ParsedImport | null>(
    null,
  )
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [confirmSignOut, setConfirmSignOut] = React.useState(false)

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
        const parsed = parseImportBundle(reader.result as string)
        setPendingImport(parsed)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import failed.')
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be chosen again later.
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
        await opportunityRepo.replaceAll(
          mergeById(opportunities, pendingImport.opportunities),
        )
        await templateRepo.replaceAll(
          mergeById(templates, pendingImport.templates),
        )
      }
      toast.success(
        `Imported ${pendingImport.contacts.length} contacts (${mode})`,
      )
    } catch (err) {
      console.error(err)
      toast.error('Import failed while writing data.')
    } finally {
      setPendingImport(null)
    }
  }

  async function handleClear() {
    await Promise.all([
      contactRepo.clear(),
      tagRepo.clear(),
      opportunityRepo.clear(),
      templateRepo.clear(),
    ])
    toast.success('All data cleared')
  }

  async function handleReset() {
    await Promise.all([
      contactRepo.clear(),
      tagRepo.clear(),
      opportunityRepo.clear(),
      templateRepo.clear(),
    ])
    const content = buildStarterContent()
    for (const tag of content.tags) {
      await tagRepo.create({ name: tag.name, color: tag.color })
    }
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

  return (
    <PageShell
      header={
        <PageHeader
          title="Settings & data"
          description="Your data is synced to your account. Back it up or move it anytime."
        />
      }
    >

      {/* Privacy note */}
      <Card className="mb-6 border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm">
            <p className="font-medium">Private to your account</p>
            <p className="text-muted-foreground">
              Your data is stored in Supabase, scoped to your account by
              row-level security — nobody else can read or write it. Export a
              backup any time from below.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Shareable profile */}
      <div className="mb-6">
        <ShareableProfileCard />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Account */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <h2 className="font-semibold">Account</h2>
            </div>
            <p className="mb-4 truncate text-sm text-muted-foreground">
              Signed in as <span className="text-foreground">{user?.email}</span>
            </p>
            <Button
              variant="outline"
              onClick={() => setConfirmSignOut(true)}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Download className="h-4 w-4" />
              <h2 className="font-semibold">Export</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Download your full network. JSON is a complete backup you can
              re-import; CSV opens in any spreadsheet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleExportJson}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <h2 className="font-semibold">Import</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Restore from a JSON backup. You'll choose whether to merge with or
              replace your current data.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <FileJson className="h-4 w-4" />
              Choose JSON file…
            </Button>
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <h2 className="font-semibold">Help</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              New here, or just want a refresher? Replay the welcome tour.
            </p>
            <Button variant="outline" onClick={openWelcomeTour} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Replay welcome tour
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-4 w-4" />
              <h2 className="font-semibold">Your data</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Contacts</dt>
                <dd className="text-2xl font-semibold">{contacts.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="text-2xl font-semibold">{tags.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Interactions</dt>
                <dd className="text-2xl font-semibold">
                  {contacts.reduce((n, c) => n + c.interactions.length, 0)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opportunities</dt>
                <dd className="text-2xl font-semibold">{opportunities.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Templates</dt>
                <dd className="text-2xl font-semibold">{templates.length}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <h2 className="font-semibold">Reset</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Start fresh, or restore the example contact and starter
              templates.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmReset(true)}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restore starter content
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmClear(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear all data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import mode dialog — offers both Merge and Replace */}
      <Dialog
        open={Boolean(pendingImport)}
        onOpenChange={(o) => !o && setPendingImport(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import data</DialogTitle>
            <DialogDescription>
              {pendingImport
                ? `Found ${pendingImport.contacts.length} contacts and ${pendingImport.tags.length} tags in this file. Merge adds them to your current data; Replace overwrites everything.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void doImport('replace')}
            >
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
        description="This permanently deletes every contact, interaction, and tag from your account. Export a backup first if you want to keep it."
        confirmLabel="Clear everything"
        destructive
        onConfirm={handleClear}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restore starter content?"
        description="This replaces your current data with the example contact and starter templates. Your existing contacts will be removed."
        confirmLabel="Restore starter content"
        destructive
        onConfirm={handleReset}
      />
      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out?"
        description="You'll need to sign back in to see your network again."
        confirmLabel="Sign out"
        onConfirm={() => void signOut()}
      />
    </PageShell>
  )
}

/** Merge two lists of records, preferring incoming items on id collision. */
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of current) map.set(item.id, item)
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}
