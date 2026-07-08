import * as React from 'react'
import { toast } from 'sonner'
import { Copy, Mail, MailWarning } from 'lucide-react'
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
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts, useTemplates } from '@/hooks/useData'
import { useMyName } from '@/hooks/useMyName'
import { TEMPLATE_CATEGORIES } from '@/lib/constants'
import { buildMailto, contactMergeSource, mergeTemplate } from '@/lib/templates'
import { fullName } from '@/lib/format'
import type { Contact } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a contact (e.g. opened from their profile). */
  contactId?: string
  /** Pre-select a template (e.g. opened from the Templates page). */
  templateId?: string
}

const NONE = '__none__'

export function ComposeDialog({
  open,
  onOpenChange,
  contactId,
  templateId,
}: Props) {
  const contacts = useContacts() ?? []
  const templates = useTemplates() ?? []
  const [myName, setMyName] = useMyName()

  const [selectedContactId, setSelectedContactId] = React.useState(NONE)
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(NONE)
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [edited, setEdited] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setSelectedContactId(contactId ?? NONE)
    setSelectedTemplateId(templateId ?? templates[0]?.id ?? NONE)
    setEdited(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contactId, templateId])

  const contact: Contact | undefined = contacts.find(
    (c) => c.id === selectedContactId,
  )
  const template = templates.find((t) => t.id === selectedTemplateId)

  // Re-merge whenever inputs change, unless the user has hand-edited the text.
  React.useEffect(() => {
    if (!open || !template || edited) return
    const merged = mergeTemplate(template, {
      contact: contact ? contactMergeSource(contact) : null,
      myName,
    })
    setSubject(merged.subject)
    setBody(merged.body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template, contact, myName, edited])

  function reset() {
    if (!template) return
    setEdited(false)
    const merged = mergeTemplate(template, {
      contact: contact ? contactMergeSource(contact) : null,
      myName,
    })
    setSubject(merged.subject)
    setBody(merged.body)
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy — try selecting the text manually.')
    }
  }

  function openEmail() {
    if (!contact?.email) {
      toast.error('This contact has no email on file.')
      return
    }
    window.location.href = buildMailto(contact.email, subject, body)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compose message</DialogTitle>
          <DialogDescription>
            Pick a template and a contact — we'll fill in the details. Edit
            freely before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(v) => {
                  setSelectedTemplateId(v)
                  setEdited(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {TEMPLATE_CATEGORIES[t.category].emoji} {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select
                value={selectedContactId}
                onValueChange={(v) => {
                  setSelectedContactId(v)
                  setEdited(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Someone else…</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {fullName(c)}
                      {c.company ? ` · ${c.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {contact && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <ContactAvatar contact={contact} className="h-6 w-6 text-[10px]" />
              <span className="min-w-0 flex-1 truncate">
                {fullName(contact)}
                {contact.company ? ` · ${contact.company}` : ''}
              </span>
              {!contact.email && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <MailWarning className="h-3.5 w-3.5" />
                  No email on file
                </span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="compose-myname">Your name</Label>
            <Input
              id="compose-myname"
              value={myName}
              onChange={(e) => {
                setMyName(e.target.value)
                setEdited(false)
              }}
              placeholder="Jane Doe"
            />
          </div>

          {template?.subject !== undefined && subject !== '' && (
            <div className="space-y-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setEdited(true)
                }}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="compose-body">Message</Label>
              {edited && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset to template
                </button>
              )}
            </div>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setEdited(true)
              }}
              className="min-h-[180px] text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copy(body, 'Message')}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy message
            </Button>
          </div>
          <Button type="button" onClick={openEmail} className="gap-1.5">
            <Mail className="h-4 w-4" />
            Open in email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
