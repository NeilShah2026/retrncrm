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
import { contactRepo } from '@/services'
import {
  INTERACTION_TYPES,
  INTERACTION_TYPE_KEYS,
} from '@/lib/constants'
import { todayISO } from '@/lib/format'
import type { Interaction, InteractionType } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  /** Present → edit an existing interaction. */
  interaction?: Interaction | null
}

export function LogInteractionDialog({
  open,
  onOpenChange,
  contactId,
  interaction,
}: Props) {
  const editing = Boolean(interaction)
  const [date, setDate] = React.useState(todayISO())
  const [type, setType] = React.useState<InteractionType>('coffee')
  const [summary, setSummary] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setDate(interaction?.date ?? todayISO())
      setType(interaction?.type ?? 'coffee')
      setSummary(interaction?.summary ?? '')
    }
  }, [open, interaction])

  async function save() {
    setSaving(true)
    try {
      if (interaction) {
        await contactRepo.updateInteraction(contactId, interaction.id, {
          date,
          type,
          summary: summary.trim(),
        })
        toast.success('Interaction updated')
      } else {
        await contactRepo.addInteraction(contactId, {
          date,
          type,
          summary: summary.trim(),
        })
        toast.success('Interaction logged · last contact updated')
      }
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save the interaction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit interaction' : 'Log interaction'}
          </DialogTitle>
          <DialogDescription>
            Recording an interaction updates their last-contact date.
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
              <Label htmlFor="int-date">Date</Label>
              <Input
                id="int-date"
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as InteractionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {INTERACTION_TYPES[k].emoji} {INTERACTION_TYPES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="int-summary">What happened?</Label>
            <Textarea
              id="int-summary"
              autoFocus
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Caught up over coffee, talked about their move to product…"
              className="min-h-[90px]"
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
              {saving ? 'Saving…' : editing ? 'Save' : 'Log it'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
