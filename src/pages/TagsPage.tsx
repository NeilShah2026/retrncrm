import * as React from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
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

  const counts = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of contacts ?? []) {
      for (const id of c.tagIds) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [contacts])

  const loading = tags === undefined

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
    toast.success(`Deleted tag “${deleting.name}”`)
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Tags"
          description="Organize your network with color-coded, reusable tags."
        >
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New tag
          </Button>
        </PageHeader>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No tags yet"
          description="Create tags like “VC”, “mentor”, or “potential client” to group and filter your contacts."
          action={<Button onClick={openNew}>Create your first tag</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => {
            const c = tagColor(tag.color)
            const count = counts.get(tag.id) ?? 0
            return (
              <Card key={tag.id} className="group">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className={cn('h-3 w-3 rounded-full', c.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{tag.name}</p>
                    {count > 0 ? (
                      <Link
                        to={ROUTES.contactsSearch(tag.name)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {count} {count === 1 ? 'contact' : 'contacts'}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No contacts
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(tag)}
                      aria-label={`Edit ${tag.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(tag)}
                      aria-label={`Delete ${tag.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <TagEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        tag={editing}
        existing={tags ?? []}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="The tag will be removed from all contacts. The contacts themselves are kept."
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
      toast.error('Tag name is required.')
      return
    }
    const dup = existing.some(
      (t) =>
        t.id !== tag?.id && t.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (dup) {
      toast.error('A tag with that name already exists.')
      return
    }
    if (tag) {
      await tagRepo.update(tag.id, { name: trimmed, color })
      toast.success('Tag updated')
    } else {
      await tagRepo.create({ name: trimmed, color })
      toast.success(`Created tag “${trimmed}”`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit tag' : 'New tag'}</DialogTitle>
          <DialogDescription>
            Name your tag and pick a color to identify it at a glance.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. potential client"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {TAG_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setColor(key)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110',
                  TAG_COLORS[key].dot,
                  color === key && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                )}
                aria-label={TAG_COLORS[key].label}
              >
                {color === key && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save' : 'Create tag'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
