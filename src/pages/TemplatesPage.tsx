import * as React from 'react'
import { Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog'
import { ComposeDialog } from '@/components/templates/ComposeDialog'
import { useTemplates } from '@/hooks/useData'
import { templateRepo } from '@/services'
import { TEMPLATE_CATEGORIES } from '@/lib/constants'
import type { OutreachTemplate } from '@/types'
import { toast } from 'sonner'

export function TemplatesPage() {
  const templates = useTemplates()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OutreachTemplate | null>(null)
  const [deleting, setDeleting] = React.useState<OutreachTemplate | null>(null)
  const [composeTemplateId, setComposeTemplateId] = React.useState<
    string | null
  >(null)

  const loading = templates === undefined

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(t: OutreachTemplate) {
    setEditing(t)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    await templateRepo.remove(deleting.id)
    toast.success(`Deleted "${deleting.name}"`)
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Templates"
          description="Reusable outreach messages — compose one and we'll fill in the details."
        >
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New template
          </Button>
        </PageHeader>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="Save a coffee-chat request, thank-you note, or referral ask once and reuse it for every contact."
          action={<Button onClick={openNew}>Create your first template</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const cat = TEMPLATE_CATEGORIES[t.category]
            return (
              <Card key={t.id} className="group flex flex-col">
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.name}</p>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {cat.emoji} {cat.label}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(t)}
                        aria-label={`Edit ${t.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(t)}
                        aria-label={`Delete ${t.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {t.subject && (
                    <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
                      {t.subject}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-3 flex-1 whitespace-pre-line text-xs text-muted-foreground">
                    {t.body}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5 self-start"
                    onClick={() => setComposeTemplateId(t.id)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Use template
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
      />
      <ComposeDialog
        open={Boolean(composeTemplateId)}
        onOpenChange={(o) => !o && setComposeTemplateId(null)}
        templateId={composeTemplateId ?? undefined}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}
