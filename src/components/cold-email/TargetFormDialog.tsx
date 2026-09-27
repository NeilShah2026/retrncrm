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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { coldTargetRepo } from '@/services'
import { isColdTargetLimitError } from '@/lib/billing/coldTargetLimit'
import { track } from '@/lib/analytics'
import type { ColdTarget } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Editing when given; adding otherwise. */
  target?: ColdTarget | null
  onSaved?: (target: ColdTarget) => void
  /** The free plan's limit refused a new one. */
  onLimit?: () => void
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  company: string
  role: string
  linkedinUrl: string
  hook: string
}

function initial(t?: ColdTarget | null): FormState {
  return {
    firstName: t?.firstName ?? '',
    lastName: t?.lastName ?? '',
    email: t?.email ?? '',
    company: t?.company ?? '',
    role: t?.role ?? '',
    linkedinUrl: t?.linkedinUrl ?? '',
    hook: t?.hook ?? '',
  }
}

/** Adding someone to write to, or correcting who they are. */
export function TargetFormDialog({ open, onOpenChange, target, onSaved, onLimit }: Props) {
  const editing = Boolean(target)
  const [form, setForm] = React.useState<FormState>(() => initial(target))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) setForm(initial(target))
  }, [open, target])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const canSave = Boolean(form.firstName.trim() || form.email.trim())

  async function save() {
    if (!canSave) return
    setSaving(true)
    const fields = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase() || undefined,
      company: form.company.trim() || undefined,
      role: form.role.trim() || undefined,
      linkedinUrl: form.linkedinUrl.trim() || undefined,
      hook: form.hook.trim() || undefined,
    }
    try {
      if (target) {
        const saved = await coldTargetRepo.update(target.id, fields)
        onSaved?.(saved)
      } else {
        const saved = await coldTargetRepo.create({ ...fields, status: 'drafting', sends: [] })
        track('cold_target_created', { source: 'app', has_hook: Boolean(fields.hook) })
        onSaved?.(saved)
      }
      onOpenChange(false)
    } catch (err) {
      if (isColdTargetLimitError(err)) {
        onOpenChange(false)
        onLimit?.()
        return
      }
      console.error(err)
      toast.error(editing ? 'Couldn’t save those changes.' : 'Couldn’t add them.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit details' : 'Add someone to email'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Who they are and why you’re writing.'
              : 'Someone you haven’t met yet. They become a contact once they write back.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cold-first">First name</Label>
              <Input
                id="cold-first"
                autoFocus
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cold-last">Last name</Label>
              <Input id="cold-last" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cold-email">Email</Label>
            <Input
              id="cold-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="Their work or school address"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cold-company">Company</Label>
              <Input id="cold-company" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cold-role">Role</Label>
              <Input
                id="cold-role"
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                placeholder="e.g. Product manager"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cold-linkedin">LinkedIn</Label>
            <Input
              id="cold-linkedin"
              type="url"
              value={form.linkedinUrl}
              onChange={(e) => set('linkedinUrl', e.target.value)}
              placeholder="linkedin.com/in/…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cold-hook">Why them?</Label>
            <Textarea
              id="cold-hook"
              rows={3}
              value={form.hook}
              onChange={(e) => set('hook', e.target.value)}
              placeholder="The specific reason you’re writing to this person"
            />
            <p className="text-xs text-muted-foreground">
              Same school, something they built or wrote, the move you’re weighing. It’s the line
              that earns a reply.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || saving} loading={saving}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
