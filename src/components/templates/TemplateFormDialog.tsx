import * as React from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { templateRepo } from '@/services'
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_KEYS } from '@/lib/constants'
import { TEMPLATE_PLACEHOLDERS } from '@/lib/templates'
import type { OutreachTemplate, TemplateCategory } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: OutreachTemplate | null
}

export function TemplateFormDialog({ open, onOpenChange, template }: Props) {
  const editing = Boolean(template)
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState<TemplateCategory>('other')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (open) {
      setName(template?.name ?? '')
      setCategory(template?.category ?? 'other')
      setSubject(template?.subject ?? '')
      setBody(template?.body ?? '')
    }
  }, [open, template])

  function insertPlaceholder(token: string) {
    const el = bodyRef.current
    if (!el) {
      setBody((b) => `${b}${token}`)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Template name is required.')
      return
    }
    if (!body.trim()) {
      toast.error('Template body is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        category,
        subject: subject.trim() || undefined,
        body,
      }
      if (template) {
        await templateRepo.update(template.id, payload)
        toast.success('Template updated')
      } else {
        await templateRepo.create(payload)
        toast.success(`Created template "${payload.name}"`)
      }
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save the template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            Use placeholders like {'{{firstName}}'} and {'{{company}}'} — they'll
            be filled in automatically when you compose a message.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Coffee chat request"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TemplateCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TEMPLATE_CATEGORIES[k].emoji} {TEMPLATE_CATEGORIES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Subject (optional)</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quick chat about {{company}}?"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-body">Body</Label>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertPlaceholder(p.token)}
                    className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={p.label}
                  >
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              id="tpl-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{firstName}}, …"
              className="min-h-[180px] font-mono text-xs"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
