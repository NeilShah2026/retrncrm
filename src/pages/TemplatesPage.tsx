import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, MoreHorizontal, Plus, Send } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonRow } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog'
import { ComposeDialog } from '@/components/templates/ComposeDialog'
import { InsetGroup, InsetRow } from '@/components/ui/inset-list'
import { useTemplates } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { templateRepo } from '@/services'
import { TEMPLATE_CATEGORIES } from '@/lib/constants'
import type { OutreachTemplate } from '@/types'
import { toast } from 'sonner'

export function TemplatesPage() {
  const templates = useTemplates()
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OutreachTemplate | null>(null)
  const [deleting, setDeleting] = React.useState<OutreachTemplate | null>(null)
  const [composeTemplateId, setComposeTemplateId] = React.useState<string | null>(null)

  // ⌘K → "Use template" lands here with ?use=<id>.
  React.useEffect(() => {
    const use = searchParams.get('use')
    if (use) {
      setComposeTemplateId(use)
      const next = new URLSearchParams(searchParams)
      next.delete('use')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

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
    toast.success(`Deleted “${deleting.name}”`)
  }

  return (
    <PageShell
      mobile={{
        title: 'Templates',
        trailing: (
          <BarButton onClick={openNew} aria-label="New template">
            <Plus strokeWidth={2.4} />
          </BarButton>
        ),
      }}
      bodyClassName={isMobile ? 'bg-grouped' : undefined}
      header={
        <PageHeader
          title="Templates"
          description="Outreach you reuse. Pick one and a contact; the placeholders fill from their record."
        >
          <Button onClick={openNew}>
            <Plus />
            New template
          </Button>
        </PageHeader>
      }
    >
      <NetworkGate
        data={templates}
        table="templates"
        skeleton={
          <div className="rounded-lg border" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} className="h-12" />
            ))}
          </div>
        }
        empty={
          <EmptyState
            variant="first-run"
            icon={Mail}
            title="No templates yet"
            description="Save a coffee-chat request, a thank-you, or a referral ask once and reuse it for anyone."
            action={
              <Button onClick={openNew}>
                <Plus />
                New template
              </Button>
            }
          />
        }
      >
        {(list) =>
          isMobile ? (
            // A phone gets one tappable row per template: the row uses it,
            // and the trailing button is the only other thing it can do.
            <InsetGroup footer="Tap a template to use it. Placeholders fill from the contact you pick.">
              {list.map((t, i) => (
                <InsetRow
                  key={t.id}
                  title={t.name}
                  subtitle={[
                    TEMPLATE_CATEGORIES[t.category].label,
                    t.subject || t.body.replace(/\s+/g, ' ').slice(0, 60),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  chevron={false}
                  accessory={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${t.name}`}
                          onClick={(e) => e.stopPropagation()}
                          className="press -mr-1 flex h-11 w-9 items-center justify-center text-muted-foreground/70"
                        >
                          <MoreHorizontal className="h-[18px] w-[18px]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleting(t)}
                          className="text-danger focus:text-danger"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                  last={i === list.length - 1}
                  onClick={() => setComposeTemplateId(t.id)}
                />
              ))}
            </InsetGroup>
          ) : (
          <ul className="overflow-hidden rounded-lg border bg-card">
            {list.map((t) => {
              const cat = TEMPLATE_CATEGORIES[t.category]
              return (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-accent/40"
                >
                  <button
                    type="button"
                    onClick={() => setComposeTemplateId(t.id)}
                    className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.name}</span>
                      <Badge variant="outline">{cat.label}</Badge>
                    </span>
                    <span className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.subject ? (
                        <>
                          <span className="text-text-secondary">{t.subject}</span>
                          <span> — </span>
                        </>
                      ) : null}
                      {t.body.replace(/\s+/g, ' ').slice(0, 140)}
                    </span>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => setComposeTemplateId(t.id)}>
                    <Send />
                    Use
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`} className="text-muted-foreground">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(t)}>Edit</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleting(t)} className="text-danger focus:text-danger">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
          )
        }
      </NetworkGate>

      <TemplateFormDialog open={formOpen} onOpenChange={setFormOpen} template={editing} />
      <ComposeDialog
        open={Boolean(composeTemplateId)}
        onOpenChange={(o) => !o && setComposeTemplateId(null)}
        templateId={composeTemplateId ?? undefined}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}
