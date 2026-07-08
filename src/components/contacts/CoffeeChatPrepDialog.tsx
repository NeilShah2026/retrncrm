import * as React from 'react'
import { toast } from 'sonner'
import {
  Coffee,
  MapPin,
  MessageSquarePlus,
  Save,
  Send,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { StrengthMeter } from '@/components/common/StrengthMeter'
import { useContact } from '@/hooks/useData'
import { contactRepo } from '@/services'
import { CONNECTION_TYPES, INTERACTION_TYPES } from '@/lib/constants'
import { getReconnectStatus } from '@/lib/reconnect'
import { fullName, formatDate, renderMarkdown } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string | undefined
  onCompose?: () => void
  onLogInteraction?: () => void
}

/**
 * A pre-meeting brief: how you met, past conversations, and standing talking
 * points — so you walk into a coffee chat (or any reconnect) already warmed up.
 */
export function CoffeeChatPrepDialog({
  open,
  onOpenChange,
  contactId,
  onCompose,
  onLogInteraction,
}: Props) {
  const contact = useContact(contactId)
  const [points, setPoints] = React.useState('')
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open && contact) {
      setPoints(contact.talkingPoints ?? '')
      setDirty(false)
    }
  }, [open, contact])

  async function savePoints() {
    if (!contact) return
    setSaving(true)
    try {
      await contactRepo.update(contact.id, { talkingPoints: points.trim() || undefined })
      setDirty(false)
      toast.success('Talking points saved')
    } catch (err) {
      console.error(err)
      toast.error('Could not save talking points.')
    } finally {
      setSaving(false)
    }
  }

  if (!contact) return null

  const status = getReconnectStatus(contact)
  const recent = [...contact.interactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
  const notesHtml = renderMarkdown(contact.notes)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-4.5 w-4.5 text-amber-600" />
            Prep for {contact.firstName}
          </DialogTitle>
          <DialogDescription>
            A quick brief before you talk — everything you'd want to remember.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto scrollbar-thin pr-1">
          <div className="flex items-center gap-3">
            <ContactAvatar contact={contact} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{fullName(contact)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[contact.jobTitle, contact.company].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <StrengthMeter value={contact.relationshipStrength} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {contact.connectionType && (
              <Badge variant="secondary" className="text-[10px]">
                {CONNECTION_TYPES[contact.connectionType].emoji}{' '}
                {CONNECTION_TYPES[contact.connectionType].label}
              </Badge>
            )}
            <Badge
              variant={status.overdue ? 'destructive' : 'outline'}
              className="text-[10px]"
            >
              {status.reason}
            </Badge>
          </div>

          {contact.howWeMet && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How you met
              </p>
              <p className="text-sm">{contact.howWeMet}</p>
              {contact.whereWeMet && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {contact.whereWeMet}
                </p>
              )}
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Talking points
              </p>
              {dirty && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void savePoints()}
                  disabled={saving}
                  className="h-6 gap-1 px-2 text-xs"
                >
                  <Save className="h-3 w-3" />
                  Save
                </Button>
              )}
            </div>
            <Textarea
              value={points}
              onChange={(e) => {
                setPoints(e.target.value)
                setDirty(true)
              }}
              onBlur={() => dirty && void savePoints()}
              placeholder="Ask about the summer internship cohort… thank them for the intro to…"
              className="min-h-[70px] text-sm"
            />
          </div>

          {recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Last time you talked
              </p>
              <ul className="space-y-2">
                {recent.map((it) => (
                  <li key={it.id} className="flex gap-2 text-sm">
                    <span className="shrink-0">
                      {INTERACTION_TYPES[it.type]?.emoji ?? '•'}
                    </span>
                    <span className="min-w-0">
                      <span className="text-muted-foreground">
                        {formatDate(it.date)} —{' '}
                      </span>
                      {it.summary || (
                        <span className="italic text-muted-foreground">
                          No summary
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {notesHtml && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </p>
              <div
                className="prose-notes"
                dangerouslySetInnerHTML={{ __html: notesHtml }}
              />
            </div>
          )}

          {recent.length === 0 && !contact.howWeMet && !notesHtml && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-1.5 h-4 w-4" />
              No history yet — this'll be your first real conversation.
            </p>
          )}
        </div>

        <Separator />
        <div className="flex flex-wrap justify-end gap-2">
          {onCompose && (
            <Button variant="outline" size="sm" onClick={onCompose} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Send a message
            </Button>
          )}
          {onLogInteraction && (
            <Button size="sm" onClick={onLogInteraction} className="gap-1.5">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Log this interaction
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
