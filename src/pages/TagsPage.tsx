import * as React from 'react'
import { Link } from 'react-router-dom'
import { Check, MoreHorizontal, Plus, Tag as TagIcon, Tags } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
import { EmptyState } from '@/components/common/EmptyState'
import { NetworkGate } from '@/components/common/NetworkGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SkeletonRow } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { AutoTagDialog } from '@/components/contacts/AutoTagDialog'
import { useContacts, useTags } from '@/hooks/useData'
import { tagRepo } from '@/services'
import { TAG_COLORS, TAG_COLOR_KEYS, tagColor } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import type { Tag } from '@/types'
import { toast } from 'sonner'

export function TagsPage() {
  const tags = useTags()
  const contacts = useContacts()
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Tag | null>(null)
  const [deleting, setDeleting] = React.useState<Tag | null>(null)
  const [autoTagOpen, setAutoTagOpen] = React.useState(false)

  const counts = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of contacts ?? []) {
      for (const id of c.tagIds) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [contacts])

  const untagged = (contacts ?? []).filter((c) => c.tagIds.length === 0).length
  const hasContacts = (contacts?.length ?? 0) > 0

  function openNew() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(tag: Tag) {
    setEditing(tag)
    setEditorOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    await tagRepo.remove(deleting.id)
    toast.success(`Deleted “${deleting.name}”`)
  }

  return (
    <PageShell
      mobile={{
        title: 'Tags',
        trailing: (
          <>
            {hasContacts && (
              <BarButton onClick={() => setAutoTagOpen(true)} aria-label="Suggest tags">
                <Tags />
              </BarButton>
            )}
            <BarButton onClick={openNew} aria-label="New tag">
              <Plus strokeWidth={2.4} />
            </BarButton>
          </>
        ),
      }}
      header={
        <PageHeader title="Tags" description="Group people by how you know them.">
          {hasContacts && (
            <Button variant="outline" onClick={() => setAutoTagOpen(true)}>
              <Tags />
              Suggest tags
            </Button>
          )}
          <Button onClick={openNew}>
            <Plus />
            New tag
          </Button>
        </PageHeader>
      }
    >
      <NetworkGate
        data={tags}
        table="tags"
        skeleton={
          <div className="rounded-lg border" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        }
        empty={
          <EmptyState
            variant="first-run"
            icon={TagIcon}
            title="No tags yet"
            description="Tags like “recruiter”, “mentor” or “fintech” make people findable later. Create one, or have the first set proposed from what you’ve written."
            action={
              <>
                {untagged > 0 && (
                  <Button onClick={() => setAutoTagOpen(true)}>
                    <Tags />
                    Suggest tags for {untagged} {untagged === 1 ? 'person' : 'people'}
                  </Button>
                )}
                <Button variant={untagged > 0 ? 'outline' : 'default'} onClick={openNew}>
                  <Plus />
                  New tag
                </Button>
              </>
            }
          />
        }
      >
        {(list) => (
          <div className="space-y-3">
            {untagged > 0 && (
              <button
                type="button"
                onClick={() => setAutoTagOpen(true)}
                className="flex h-11 w-full items-center gap-3 rounded-lg border border-dashed px-3 text-left text-sm transition-colors duration-fast hover:border-border-strong hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">
                    {untagged} {untagged === 1 ? 'person has' : 'people have'} no tags.
                  </span>{' '}
                  <span className="text-muted-foreground">
                    Propose tags from their records; you approve before anything is saved.
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-text-secondary">Suggest</span>
              </button>
            )}

            <ul className="overflow-hidden rounded-lg border bg-card">
              {list.map((tag) => {
                const c = tagColor(tag.color)
                const count = counts.get(tag.id) ?? 0
                return (
                  <li key={tag.id} className="group flex h-10 items-center gap-3 border-b px-3 last:border-b-0 hover:bg-accent/40">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', c.dot)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{tag.name}</span>
                    {count > 0 ? (
                      <Link
                        to={ROUTES.contactsSearch(tag.name)}
                        className="tnum text-xs text-muted-foreground hover:text-foreground"
                      >
                        {count} {count === 1 ? 'contact' : 'contacts'}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">No contacts</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${tag.name}`} className="text-muted-foreground">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tag)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleting(tag)} className="text-danger focus:text-danger">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </NetworkGate>

      <AutoTagDialog open={autoTagOpen} onOpenChange={setAutoTagOpen} />

      <TagEditorDialog open={editorOpen} onOpenChange={setEditorOpen} tag={editing} existing={tags ?? []} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="The tag is removed from every contact. The contacts themselves are kept."
        confirmLabel="Delete tag"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  )
}

function TagEditorDialog({
  open,
  onOpenChange,
  tag,
  existing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: Tag | null
  existing: Tag[]
}) {
  const editing = Boolean(tag)
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState('slate')

  React.useEffect(() => {
    if (open) {
      setName(tag?.name ?? '')
      setColor(tag?.color ?? TAG_COLOR_KEYS[existing.length % TAG_COLOR_KEYS.length])
    }
  }, [open, tag, existing.length])

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Give the tag a name.')
      return
    }
    const dup = existing.some((t) => t.id !== tag?.id && t.name.toLowerCase() === trimmed.toLowerCase())
    if (dup) {
      toast.error('A tag with that name already exists.')
      return
    }
    if (tag) {
      await tagRepo.update(tag.id, { name: trimmed, color })
      toast.success('Tag updated')
    } else {
      await tagRepo.create({ name: trimmed, color })
      toast.success(`Created “${trimmed}”`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit tag' : 'New tag'}</DialogTitle>
          <DialogDescription>A short name and a colour you’ll recognise in a list.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="space-y-4"
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="recruiter, mentor, fintech…" aria-label="Tag name" />
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
            {TAG_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={color === key}
                onClick={() => setColor(key)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-shadow duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  TAG_COLORS[key].dot,
                  color === key && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                )}
                aria-label={TAG_COLORS[key].label}
              >
                {color === key && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save' : 'Create tag'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
