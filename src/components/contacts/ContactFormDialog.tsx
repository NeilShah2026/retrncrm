import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ChevronDown,
  ClipboardPaste,
  Link2,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { StrengthMeter } from '@/components/common/StrengthMeter'
import { TagSelect } from './TagSelect'
import { contactRepo } from '@/services'
import { useContacts } from '@/hooks/useData'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_KEYS,
  FREQUENCY_KEYS,
  FREQUENCY_OPTIONS,
  MEET_SOURCES,
  MEET_SOURCE_KEYS,
} from '@/lib/constants'
import { createId } from '@/lib/utils'
import { fullName } from '@/lib/format'
import { parseLinkedIn } from '@/lib/linkedin'
import type {
  Contact,
  ConnectionType,
  ContactFrequency,
  MeetSource,
  OtherLink,
} from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present → edit mode. */
  contact?: Contact | null
  onSaved?: (contact: Contact) => void
}

interface FormState {
  firstName: string
  lastName: string
  photo?: string
  company: string
  jobTitle: string
  industry: string
  email: string
  phone: string
  linkedinUrl: string
  twitter: string
  otherLinks: OtherLink[]
  connectionType: ConnectionType | ''
  source: MeetSource | ''
  school: string
  gradYear: string
  major: string
  introducedById: string
  howWeMet: string
  whereWeMet: string
  dateMet: string
  tagIds: string[]
  relationshipStrength: number
  lastContactDate: string
  contactFrequencyGoal: ContactFrequency
  notes: string
}

function initialState(contact?: Contact | null): FormState {
  return {
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    photo: contact?.photo,
    company: contact?.company ?? '',
    jobTitle: contact?.jobTitle ?? '',
    industry: contact?.industry ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    linkedinUrl: contact?.linkedinUrl ?? '',
    twitter: contact?.twitter ?? '',
    otherLinks: contact?.otherLinks ?? [],
    connectionType: contact?.connectionType ?? '',
    source: contact?.source ?? '',
    school: contact?.school ?? '',
    gradYear: contact?.gradYear ?? '',
    major: contact?.major ?? '',
    introducedById: contact?.introducedById ?? '',
    howWeMet: contact?.howWeMet ?? '',
    whereWeMet: contact?.whereWeMet ?? '',
    dateMet: contact?.dateMet ?? '',
    tagIds: contact?.tagIds ?? [],
    relationshipStrength: contact?.relationshipStrength ?? 3,
    lastContactDate: contact?.lastContactDate ?? '',
    contactFrequencyGoal: contact?.contactFrequencyGoal ?? 'none',
    notes: contact?.notes ?? '',
  }
}

const NONE_VALUE = '__none__'

const MAX_PHOTO_BYTES = 3 * 1024 * 1024

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: Props) {
  const editing = Boolean(contact)
  const allContacts = useContacts() ?? []
  const [form, setForm] = React.useState<FormState>(() => initialState(contact))
  const [expanded, setExpanded] = React.useState(false)
  const [duplicates, setDuplicates] = React.useState<Contact[]>([])
  const [saving, setSaving] = React.useState(false)
  const [liOpen, setLiOpen] = React.useState(false)
  const [liText, setLiText] = React.useState('')
  const [photoOpen, setPhotoOpen] = React.useState(false)
  const [photoUrl, setPhotoUrl] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Candidates for "who introduced you" — everyone except this contact.
  const introducers = allContacts
    .filter((c) => c.id !== contact?.id)
    .sort((a, b) => fullName(a).localeCompare(fullName(b)))

  function applyLinkedIn() {
    const parsed = parseLinkedIn(liText)
    if (
      !parsed.firstName &&
      !parsed.company &&
      !parsed.jobTitle &&
      !parsed.linkedinUrl
    ) {
      toast.error("Couldn't find much — paste the profile's text or its URL.")
      return
    }
    setForm((f) => ({
      ...f,
      // Only fill empty fields so we never clobber what you've typed.
      firstName: f.firstName || parsed.firstName || '',
      lastName: f.lastName || parsed.lastName || '',
      jobTitle: f.jobTitle || parsed.jobTitle || '',
      company: f.company || parsed.company || '',
      linkedinUrl: f.linkedinUrl || parsed.linkedinUrl || '',
    }))
    setDuplicates([])
    setLiOpen(false)
    setLiText('')
    const filled = [
      parsed.firstName && 'name',
      parsed.jobTitle && 'title',
      parsed.company && 'company',
      parsed.linkedinUrl && 'LinkedIn',
    ].filter(Boolean)
    toast.success(`Filled ${filled.join(', ') || 'what we could find'} — review below`)
  }

  // Reset the form whenever the dialog is (re)opened for a new target.
  React.useEffect(() => {
    if (open) {
      setForm(initialState(contact))
      setExpanded(Boolean(contact))
      setDuplicates([])
    }
  }, [open, contact])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === 'firstName' || key === 'lastName' || key === 'company') {
      setDuplicates([])
    }
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Image is too large (max 3 MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set('photo', reader.result as string)
    reader.readAsDataURL(file)
  }

  function addLink() {
    set('otherLinks', [
      ...form.otherLinks,
      { id: createId(), label: '', url: '' },
    ])
  }

  function updateLink(id: string, patch: Partial<OtherLink>) {
    set(
      'otherLinks',
      form.otherLinks.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    )
  }

  function removeLink(id: string) {
    set(
      'otherLinks',
      form.otherLinks.filter((l) => l.id !== id),
    )
  }

  const canSave = form.firstName.trim().length > 0

  async function save(force = false) {
    if (!canSave) {
      toast.error('A first name is required.')
      return
    }
    setSaving(true)
    try {
      // Duplicate detection (name + company) unless already acknowledged.
      if (!force) {
        const dups = await contactRepo.findDuplicates(
          form.firstName,
          form.lastName,
          form.company || undefined,
          contact?.id,
        )
        if (dups.length) {
          setDuplicates(dups)
          setSaving(false)
          return
        }
      }

      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        photo: form.photo,
        company: form.company.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        industry: form.industry.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        linkedinUrl: form.linkedinUrl.trim() || undefined,
        twitter: form.twitter.trim() || undefined,
        otherLinks: form.otherLinks.filter((l) => l.url.trim()),
        connectionType: form.connectionType || undefined,
        source: form.source || undefined,
        school: form.school.trim() || undefined,
        gradYear: form.gradYear.trim() || undefined,
        major: form.major.trim() || undefined,
        introducedById: form.introducedById || undefined,
        howWeMet: form.howWeMet.trim() || undefined,
        whereWeMet: form.whereWeMet.trim() || undefined,
        dateMet: form.dateMet || undefined,
        tagIds: form.tagIds,
        relationshipStrength: form.relationshipStrength,
        lastContactDate: form.lastContactDate || undefined,
        contactFrequencyGoal: form.contactFrequencyGoal,
        notes: form.notes.trim() || undefined,
      }

      let result: Contact
      if (contact) {
        result = await contactRepo.update(contact.id, payload)
        toast.success('Contact updated')
      } else {
        result = await contactRepo.create(payload)
        toast.success(`${fullName(result)} added to your network`)
      }
      onSaved?.(result)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit contact' : 'New contact'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the details for this contact.'
              : 'A name is all you need — everything else is optional.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="space-y-5"
        >
          {/* Quick-fill from LinkedIn (paste-to-parse — no scraping) */}
          <Popover open={liOpen} onOpenChange={setLiOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full gap-2">
                <ClipboardPaste className="h-4 w-4 text-[#0a66c2]" />
                Paste from LinkedIn to auto-fill
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(30rem,88vw)]">
              <p className="mb-2 text-xs text-muted-foreground">
                Open their LinkedIn profile, select the top section (or the whole
                page), copy, and paste below — or just paste the profile URL.
                We'll fill what we can; you review before saving.
              </p>
              <Textarea
                autoFocus
                value={liText}
                onChange={(e) => setLiText(e.target.value)}
                placeholder="Paste profile text or URL…"
                className="min-h-[120px] font-mono text-xs"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLiOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyLinkedIn}
                  className="gap-1"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Fill fields
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Photo + essentials */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative"
                aria-label="Upload photo"
              >
                <ContactAvatar
                  contact={form}
                  className="h-16 w-16 text-lg"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Upload className="h-5 w-5 text-white" />
                </span>
              </button>
              {form.photo ? (
                <button
                  type="button"
                  onClick={() => set('photo', undefined)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              ) : (
                <Popover open={photoOpen} onOpenChange={setPhotoOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Photo URL
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64">
                    <Label className="text-xs">Paste an image URL</Label>
                    <Input
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://…/photo.jpg"
                      className="mt-1.5 h-8"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        if (photoUrl.trim()) set('photo', photoUrl.trim())
                        setPhotoOpen(false)
                        setPhotoUrl('')
                      }}
                    >
                      Use photo
                    </Button>
                  </PopoverContent>
                </Popover>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  autoFocus
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  placeholder="Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) => set('jobTitle', e.target.value)}
                  placeholder="Product Manager"
                />
              </div>
            </div>
          </div>

          {/* Relationship type + how you met (student-centered) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Select
                value={form.connectionType || NONE_VALUE}
                onValueChange={(v) =>
                  set('connectionType', v === NONE_VALUE ? '' : (v as ConnectionType))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not set</SelectItem>
                  {CONNECTION_TYPE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CONNECTION_TYPES[k].emoji} {CONNECTION_TYPES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>How you met</Label>
              <Select
                value={form.source || NONE_VALUE}
                onValueChange={(v) =>
                  set('source', v === NONE_VALUE ? '' : (v as MeetSource))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not set</SelectItem>
                  {MEET_SOURCE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {MEET_SOURCES[k].emoji} {MEET_SOURCES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* How we met — the memorable bit, kept prominent */}
          <div className="space-y-1.5">
            <Label htmlFor="howWeMet">How we met</Label>
            <Textarea
              id="howWeMet"
              value={form.howWeMet}
              onChange={(e) => set('howWeMet', e.target.value)}
              placeholder="Sat next to him on the bus to Boston…"
              className="min-h-[60px]"
            />
          </div>

          {duplicates.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Possible duplicate
                </p>
                <p className="text-amber-700 dark:text-amber-200/80">
                  You already have{' '}
                  {duplicates.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      <strong>{fullName(d)}</strong>
                      {d.company ? ` (${d.company})` : ''}
                    </span>
                  ))}
                  .
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void save(true)}
                    disabled={saving}
                  >
                    Save anyway
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDuplicates([])}
                  >
                    Keep editing
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Advanced section */}
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  expanded && 'rotate-180',
                )}
              />
              {expanded ? 'Fewer details' : 'More details'}
            </button>
          </div>

          {expanded && (
            <div className="space-y-5 animate-fade-in">
              {/* Meeting context */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="whereWeMet">Where we met</Label>
                  <Input
                    id="whereWeMet"
                    value={form.whereWeMet}
                    onChange={(e) => set('whereWeMet', e.target.value)}
                    placeholder="Peter Pan bus, NYC → Boston"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateMet">Date met</Label>
                  <Input
                    id="dateMet"
                    type="date"
                    value={form.dateMet}
                    onChange={(e) => set('dateMet', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={form.industry}
                    onChange={(e) => set('industry', e.target.value)}
                    placeholder="Finance"
                  />
                </div>
              </div>

              {/* Education */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="school">School</Label>
                  <Input
                    id="school"
                    value={form.school}
                    onChange={(e) => set('school', e.target.value)}
                    placeholder="Babson College"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gradYear">Grad year</Label>
                  <Input
                    id="gradYear"
                    value={form.gradYear}
                    onChange={(e) => set('gradYear', e.target.value)}
                    placeholder="2026"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="major">Major / field</Label>
                  <Input
                    id="major"
                    value={form.major}
                    onChange={(e) => set('major', e.target.value)}
                    placeholder="Finance"
                  />
                </div>
              </div>

              {/* Warm-intro link */}
              <div className="space-y-1.5">
                <Label>Who introduced you?</Label>
                <Select
                  value={form.introducedById || NONE_VALUE}
                  onValueChange={(v) =>
                    set('introducedById', v === NONE_VALUE ? '' : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No one / met directly" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      No one / met directly
                    </SelectItem>
                    {introducers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {fullName(c)}
                        {c.company ? ` · ${c.company}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Powers the warm-intro graph on the Network page.
                </p>
              </div>

              {/* Contact channels */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkedinUrl">LinkedIn</Label>
                  <Input
                    id="linkedinUrl"
                    value={form.linkedinUrl}
                    onChange={(e) => set('linkedinUrl', e.target.value)}
                    placeholder="https://linkedin.com/in/…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="twitter">Twitter / X</Label>
                  <Input
                    id="twitter"
                    value={form.twitter}
                    onChange={(e) => set('twitter', e.target.value)}
                    placeholder="https://x.com/…"
                  />
                </div>
              </div>

              {/* Other links */}
              <div className="space-y-2">
                <Label>Other links</Label>
                {form.otherLinks.map((link) => (
                  <div key={link.id} className="flex gap-2">
                    <Input
                      value={link.label}
                      onChange={(e) =>
                        updateLink(link.id, { label: e.target.value })
                      }
                      placeholder="Label"
                      className="w-1/3"
                    />
                    <Input
                      value={link.url}
                      onChange={(e) =>
                        updateLink(link.id, { url: e.target.value })
                      }
                      placeholder="https://…"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLink(link.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLink}
                  className="gap-1"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Add link
                </Button>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagSelect
                  value={form.tagIds}
                  onChange={(v) => set('tagIds', v)}
                />
              </div>

              {/* Relationship + cadence */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Relationship strength</Label>
                  <StrengthMeter
                    value={form.relationshipStrength}
                    onChange={(v) => set('relationshipStrength', v)}
                    size="md"
                    showLabel
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastContactDate">Last contact</Label>
                  <Input
                    id="lastContactDate"
                    type="date"
                    value={form.lastContactDate}
                    onChange={(e) => set('lastContactDate', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact goal</Label>
                  <Select
                    value={form.contactFrequencyGoal}
                    onValueChange={(v) =>
                      set('contactFrequencyGoal', v as ContactFrequency)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {FREQUENCY_OPTIONS[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  Notes{' '}
                  <span className="font-normal text-muted-foreground">
                    · markdown supported
                  </span>
                </Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="**Follow up** about the seed round…"
                  className="min-h-[100px] font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            {editing ? (
              <span className="text-xs text-muted-foreground">
                Editing {fullName(contact!)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                <Plus className="mr-1 inline h-3 w-3" />
                Quick add — save now, refine later
              </span>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave || saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
