import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  CircleMinus,
  CirclePlus,
  ClipboardPaste,
  Link2,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  SheetBar,
  SheetBarButton,
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
import {
  Collapsible,
  InsetDateRow,
  InsetGroup,
  InsetInputRow,
  InsetRow,
  InsetSelectRow,
  InsetTextareaRow,
} from '@/components/ui/inset-list'
import { StrengthMeter } from '@/components/common/StrengthMeter'
import { TagSelect } from './TagSelect'
import { TagSuggestBar } from './TagSuggestBar'
import { contactRepo } from '@/services'
import { useContacts } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_KEYS,
  FREQUENCY_KEYS,
  FREQUENCY_OPTIONS,
  MEET_SOURCES,
  MEET_SOURCE_KEYS,
  STRENGTH_LABELS,
} from '@/lib/constants'
import { dismissKeyboard } from '@/lib/keyboard'
import { tapFeedback } from '@/lib/haptics'
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

/** A field the sheet can be opened straight onto. */
export type ContactField =
  | 'firstName'
  | 'company'
  | 'email'
  | 'phone'
  | 'linkedinUrl'
  | 'howWeMet'
  | 'notes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present → edit mode. */
  contact?: Contact | null
  /**
   * Open with this field focused and its section already expanded — what
   * "Add email" on a contact's page opens.
   */
  focusField?: ContactField
  /** Pre-filled fields for a new contact (e.g. handed over from voice capture). */
  prefill?: Partial<Contact>
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

function initialState(
  contact?: Contact | null,
  prefill?: Partial<Contact>,
): FormState {
  // Editing an existing contact always wins; otherwise a prefill (voice
  // capture, LinkedIn paste) seeds the blank form.
  const contactValues = contact ?? prefill
  return {
    firstName: contactValues?.firstName ?? '',
    lastName: contactValues?.lastName ?? '',
    photo: contactValues?.photo,
    company: contactValues?.company ?? '',
    jobTitle: contactValues?.jobTitle ?? '',
    industry: contactValues?.industry ?? '',
    email: contactValues?.email ?? '',
    phone: contactValues?.phone ?? '',
    linkedinUrl: contactValues?.linkedinUrl ?? '',
    twitter: contactValues?.twitter ?? '',
    otherLinks: contactValues?.otherLinks ?? [],
    connectionType: contactValues?.connectionType ?? '',
    source: contactValues?.source ?? '',
    school: contactValues?.school ?? '',
    gradYear: contactValues?.gradYear ?? '',
    major: contactValues?.major ?? '',
    introducedById: contactValues?.introducedById ?? '',
    howWeMet: contactValues?.howWeMet ?? '',
    whereWeMet: contactValues?.whereWeMet ?? '',
    dateMet: contactValues?.dateMet ?? '',
    tagIds: contactValues?.tagIds ?? [],
    relationshipStrength: contactValues?.relationshipStrength ?? 3,
    lastContactDate: contactValues?.lastContactDate ?? '',
    contactFrequencyGoal: contactValues?.contactFrequencyGoal ?? 'none',
    notes: contactValues?.notes ?? '',
  }
}

const NONE_VALUE = '__none__'

const MAX_PHOTO_BYTES = 3 * 1024 * 1024

/** Ties the pinned footer's submit button back to the scrolling form. */
const FORM_ID = 'contact-form'

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  focusField,
  prefill,
  onSaved,
}: Props) {
  const editing = Boolean(contact)
  const isMobile = useIsMobile()
  const allContacts = useContacts() ?? []
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(contact, prefill),
  )
  const [expanded, setExpanded] = React.useState(false)
  const [duplicates, setDuplicates] = React.useState<Contact[]>([])
  const [saving, setSaving] = React.useState(false)
  const [liOpen, setLiOpen] = React.useState(false)
  const [liText, setLiText] = React.useState('')
  const [photoOpen, setPhotoOpen] = React.useState(false)
  const [photoUrl, setPhotoUrl] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const firstNameRef = React.useRef<HTMLInputElement>(null)
  const lastNameRef = React.useRef<HTMLInputElement>(null)
  const companyRef = React.useRef<HTMLInputElement>(null)
  const jobTitleRef = React.useRef<HTMLInputElement>(null)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const phoneRef = React.useRef<HTMLInputElement>(null)
  const linkedinRef = React.useRef<HTMLInputElement>(null)
  const howWeMetRef = React.useRef<HTMLTextAreaElement>(null)
  const notesRef = React.useRef<HTMLTextAreaElement>(null)
  const fieldRefs: Record<ContactField, React.RefObject<HTMLElement | null>> = {
    firstName: firstNameRef,
    company: companyRef,
    email: emailRef,
    phone: phoneRef,
    linkedinUrl: linkedinRef,
    howWeMet: howWeMetRef,
    notes: notesRef,
  }
  // What the duplicate notice last said, so it can ease shut still saying it.
  const shownDuplicates = React.useRef<Contact[]>([])
  if (duplicates.length > 0) shownDuplicates.current = duplicates

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
      setForm(initialState(contact, prefill))
      // A prefill has already filled fields that live below the fold — open
      // the extra section so nothing arrives hidden.
      setExpanded(Boolean(contact) || Boolean(prefill) || Boolean(focusField))
      setDuplicates([])
      setLiOpen(false)
      setLiText('')
    }
  }, [open, contact, prefill, focusField])

  /*
   * Opened onto a particular field ("Add email" on someone's page): wait for
   * the sheet to arrive, bring the row into view, then put the cursor in it.
   * Focusing any earlier fights the sheet's own entrance.
   */
  React.useEffect(() => {
    if (!open || !focusField || !isMobile) return
    const timer = window.setTimeout(() => {
      const field = fieldRefs[focusField]?.current
      if (!field) return
      field.scrollIntoView({ block: 'center' })
      field.focus({ preventScroll: true })
    }, 380)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusField, isMobile])

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

  const actionLabel =
    duplicates.length > 0 ? (editing ? 'Save Anyway' : 'Add Anyway') : editing ? 'Done' : 'Add'

  /**
   * The phone's form, the way iOS Contacts takes a card: a bar with Cancel
   * and Add, the photo, and inset groups whose rows *are* the fields. The
   * rarely-needed fields fold away under More Details, easing open in place.
   */
  function renderPhone() {
    return (
      <DialogContent
        tall
        hideClose
        padded={false}
        className="bg-grouped"
        // A new card goes straight to its first field, as in Contacts — the
        // sheet exists to be typed into. An existing one opens to read.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          if (!editing) firstNameRef.current?.focus({ preventScroll: true })
        }}
      >
        <DialogHeader>
          <SheetBar
            leading={<SheetBarButton close>Cancel</SheetBarButton>}
            title={editing ? 'Edit Contact' : 'New Contact'}
            trailing={
              <SheetBarButton
                strong
                disabled={!canSave || saving}
                onClick={() => void save(duplicates.length > 0)}
              >
                {actionLabel}
              </SheetBarButton>
            }
          />
          <DialogDescription className="sr-only">
            {editing
              ? 'Update the details for this contact.'
              : 'A name is all you need — everything else is optional.'}
          </DialogDescription>
        </DialogHeader>

        <form
          id={FORM_ID}
          onSubmit={(e) => {
            // Return on the keyboard puts it away; Add is in the bar.
            e.preventDefault()
            dismissKeyboard()
          }}
          className="space-y-6 px-4 pb-8 pt-1"
        >
          <div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="press rounded-full"
                aria-label={form.photo ? 'Change photo' : 'Add photo'}
              >
                {form.photo || form.firstName.trim() || form.lastName.trim() ? (
                  <ContactAvatar contact={form} className="h-20 w-20 text-2xl" />
                ) : (
                  // Nothing to make initials from yet: the empty well iOS
                  // Contacts shows, rather than an avatar of a question mark.
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground">
                    <Camera className="h-7 w-7" strokeWidth={1.7} />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  if (form.photo) set('photo', undefined)
                  else fileInputRef.current?.click()
                }}
                className="press text-ios-subhead px-2 py-1 font-medium text-brand"
              >
                {form.photo ? 'Remove Photo' : 'Add Photo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />
            </div>

            <Collapsible open={duplicates.length > 0}>
              <p
                className="text-ios-footnote mt-4 rounded-[12px] bg-warning-soft px-4 py-3 text-warning"
                aria-live="polite"
              >
                You already have{' '}
                {shownDuplicates.current.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    <strong className="font-semibold">{fullName(d)}</strong>
                    {d.company ? ` (${d.company})` : ''}
                  </span>
                ))}
                . Tap {actionLabel} to keep both.
              </p>
            </Collapsible>
          </div>

          <InsetGroup>
            <InsetInputRow
              ref={firstNameRef}
              id="firstName"
              value={form.firstName}
              onChange={(v) => set('firstName', v)}
              placeholder="First name"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              onEnter={() => lastNameRef.current?.focus({ preventScroll: true })}
            />
            <InsetInputRow
              ref={lastNameRef}
              value={form.lastName}
              onChange={(v) => set('lastName', v)}
              placeholder="Last name"
              autoComplete="family-name"
              autoCapitalize="words"
              enterKeyHint="next"
              onEnter={() => companyRef.current?.focus({ preventScroll: true })}
              last
            />
          </InsetGroup>

          <InsetGroup>
            <InsetInputRow
              ref={companyRef}
              value={form.company}
              onChange={(v) => set('company', v)}
              placeholder="Company"
              autoComplete="organization"
              autoCapitalize="words"
              enterKeyHint="next"
              onEnter={() => jobTitleRef.current?.focus({ preventScroll: true })}
            />
            <InsetInputRow
              ref={jobTitleRef}
              value={form.jobTitle}
              onChange={(v) => set('jobTitle', v)}
              placeholder="Role or title"
              autoComplete="organization-title"
              autoCapitalize="words"
              enterKeyHint="done"
              onEnter={dismissKeyboard}
              last
            />
          </InsetGroup>

          <InsetGroup>
            <InsetSelectRow
              label="Relationship"
              value={form.connectionType}
              onChange={(v) => set('connectionType', v as ConnectionType | '')}
              options={CONNECTION_TYPE_KEYS.map((k) => ({
                value: k,
                label: `${CONNECTION_TYPES[k].emoji} ${CONNECTION_TYPES[k].label}`,
              }))}
            />
            <InsetSelectRow
              label="How you met"
              value={form.source}
              onChange={(v) => set('source', v as MeetSource | '')}
              options={MEET_SOURCE_KEYS.map((k) => ({
                value: k,
                label: `${MEET_SOURCES[k].emoji} ${MEET_SOURCES[k].label}`,
              }))}
              last
            />
          </InsetGroup>

          <InsetGroup title="The story">
            <InsetTextareaRow
              ref={howWeMetRef}
              value={form.howWeMet}
              onChange={(v) => set('howWeMet', v)}
              placeholder="How you met, in a sentence"
              last
            />
          </InsetGroup>

          <InsetGroup
            footer={
              <Collapsible open={liOpen}>
                <p>
                  On their profile, copy the top section (or the page), or just its URL, and
                  paste it above. Only empty fields are filled.
                </p>
              </Collapsible>
            }
          >
            <InsetRow
              leading={<ClipboardPaste className="h-5 w-5 text-brand" />}
              title={<span className="text-brand">Paste from LinkedIn</span>}
              chevron={false}
              accessory={
                <ChevronDown
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 text-muted-foreground/60 transition-transform duration-300',
                    liOpen && 'rotate-180',
                  )}
                />
              }
              last={!liOpen}
              onClick={() => setLiOpen((v) => !v)}
            />
            <Collapsible open={liOpen}>
              <InsetTextareaRow
                value={liText}
                onChange={setLiText}
                placeholder="Profile text or URL"
                rows={3}
              />
              <InsetRow title="Fill Fields" centered disabled={!liText.trim()} onClick={applyLinkedIn} last />
            </Collapsible>
          </InsetGroup>

          <div>
            <InsetGroup>
              <InsetRow
                title={<span className="text-brand">{expanded ? 'Fewer Details' : 'More Details'}</span>}
                chevron={false}
                accessory={
                  <ChevronDown
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 text-muted-foreground/60 transition-transform duration-300',
                      expanded && 'rotate-180',
                    )}
                  />
                }
                last
                onClick={() => setExpanded((v) => !v)}
              />
            </InsetGroup>

            <Collapsible open={expanded} className="space-y-6 pt-6">
              <InsetGroup title="Where and when">
                <InsetInputRow
                  label="Where"
                  value={form.whereWeMet}
                  onChange={(v) => set('whereWeMet', v)}
                  placeholder="Career fair, a class…"
                  autoCapitalize="sentences"
                />
                <InsetDateRow
                  label="Date met"
                  value={form.dateMet || undefined}
                  onChange={(v) => set('dateMet', v ?? '')}
                />
                <InsetInputRow
                  label="Industry"
                  value={form.industry}
                  onChange={(v) => set('industry', v)}
                  placeholder="Industry"
                  autoCapitalize="words"
                  last
                />
              </InsetGroup>

              <InsetGroup title="Education">
                <InsetInputRow
                  label="School"
                  value={form.school}
                  onChange={(v) => set('school', v)}
                  placeholder="School"
                  autoCapitalize="words"
                />
                <InsetInputRow
                  label="Grad year"
                  value={form.gradYear}
                  onChange={(v) => set('gradYear', v)}
                  placeholder="YYYY"
                  inputMode="numeric"
                />
                <InsetInputRow
                  label="Major"
                  value={form.major}
                  onChange={(v) => set('major', v)}
                  placeholder="Major or field"
                  autoCapitalize="words"
                  last
                />
              </InsetGroup>

              <InsetGroup title="Contact info">
                <InsetInputRow
                  ref={emailRef}
                  label="Email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  placeholder="name@school.edu"
                />
                <InsetInputRow
                  ref={phoneRef}
                  label="Phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(v) => set('phone', v)}
                  placeholder="Phone"
                />
                <InsetInputRow
                  ref={linkedinRef}
                  label="LinkedIn"
                  type="url"
                  inputMode="url"
                  value={form.linkedinUrl}
                  onChange={(v) => set('linkedinUrl', v)}
                  placeholder="linkedin.com/in/…"
                />
                <InsetInputRow
                  label="X"
                  inputMode="url"
                  value={form.twitter}
                  onChange={(v) => set('twitter', v)}
                  placeholder="x.com/…"
                  last
                />
              </InsetGroup>

              <InsetGroup title="Other links">
                {form.otherLinks.map((link) => (
                  <div key={link.id} className="flex items-stretch pl-2">
                    <button
                      type="button"
                      onClick={() => {
                        tapFeedback()
                        removeLink(link.id)
                      }}
                      aria-label="Remove link"
                      className="press flex w-10 shrink-0 items-center justify-center"
                    >
                      <CircleMinus className="h-[22px] w-[22px] fill-danger text-white" />
                    </button>
                    <span className="hairline-b flex min-h-[44px] min-w-0 flex-1 items-center gap-3 pr-4">
                      <input
                        value={link.label}
                        onChange={(e) => updateLink(link.id, { label: e.target.value })}
                        placeholder="Label"
                        aria-label="Link label"
                        autoCapitalize="words"
                        className="text-ios-body w-20 shrink-0 bg-transparent text-brand outline-none placeholder:text-muted-foreground/70"
                      />
                      <input
                        value={link.url}
                        onChange={(e) => updateLink(link.id, { url: e.target.value })}
                        placeholder="URL"
                        aria-label="Link URL"
                        type="url"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="text-ios-body min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
                      />
                    </span>
                  </div>
                ))}
                <InsetRow
                  leading={<CirclePlus className="h-[22px] w-[22px] fill-success text-white" />}
                  title="Add Link"
                  chevron={false}
                  last
                  onClick={addLink}
                />
              </InsetGroup>

              <InsetGroup
                title="Tags"
                footer={
                  <TagSuggestBar
                    subject={form}
                    value={form.tagIds}
                    onChange={(v) => set('tagIds', v)}
                    auto={!editing}
                    className="pt-1"
                  />
                }
              >
                <div className="px-4 py-3">
                  <TagSelect value={form.tagIds} onChange={(v) => set('tagIds', v)} />
                </div>
              </InsetGroup>

              <InsetGroup title="Keeping in touch">
                <InsetSelectRow
                  label="Closeness"
                  allowNone={false}
                  value={String(form.relationshipStrength)}
                  onChange={(v) => set('relationshipStrength', Number(v) || 3)}
                  options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: STRENGTH_LABELS[n] }))}
                />
                <InsetDateRow
                  label="Last contact"
                  value={form.lastContactDate || undefined}
                  onChange={(v) => set('lastContactDate', v ?? '')}
                />
                <InsetSelectRow
                  label="Catch-up goal"
                  allowNone={false}
                  value={form.contactFrequencyGoal}
                  onChange={(v) => set('contactFrequencyGoal', (v || 'none') as ContactFrequency)}
                  options={FREQUENCY_KEYS.map((k) => ({ value: k, label: FREQUENCY_OPTIONS[k].label }))}
                  last
                />
              </InsetGroup>

              <InsetGroup footer="Powers the warm-intro graph on the Network page.">
                <InsetSelectRow
                  label="Introduced by"
                  placeholder="No one"
                  value={form.introducedById}
                  onChange={(v) => set('introducedById', v)}
                  options={introducers.map((c) => ({
                    value: c.id,
                    label: `${fullName(c)}${c.company ? ` · ${c.company}` : ''}`,
                  }))}
                  last
                />
              </InsetGroup>

              <InsetGroup title="Notes">
                <InsetTextareaRow
                  ref={notesRef}
                  value={form.notes}
                  onChange={(v) => set('notes', v)}
                  placeholder="Anything worth remembering"
                  rows={4}
                  last
                />
              </InsetGroup>
            </Collapsible>
          </div>
        </form>
      </DialogContent>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isMobile ? (
        renderPhone()
      ) : (
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit contact' : 'New contact'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the details for this contact.'
                : 'A name is all you need — everything else is optional.'}
            </DialogDescription>
          </DialogHeader>

          <form
            id={FORM_ID}
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
            className="space-y-5"
          >
            {/* Quick-fill from LinkedIn (paste-to-parse — no scraping) */}
            <Popover open={liOpen} onOpenChange={setLiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                >
                  <ClipboardPaste />
                  Paste from LinkedIn
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(30rem,88vw)]">
                <p className="mb-2 text-xs text-muted-foreground">
                  Open their LinkedIn profile, select the top section (or the whole
                  page), copy, and paste below — or just paste the profile URL.
                  What can be read is filled in; you review before saving.
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
                    Fill fields
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Photo + essentials */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2 self-center sm:self-start">
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

              <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name *</Label>
                  <Input
                    id="firstName"
                    autoFocus
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    placeholder="Company"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jobTitle">Job title</Label>
                  <Input
                    id="jobTitle"
                    value={form.jobTitle}
                    onChange={(e) => set('jobTitle', e.target.value)}
                    placeholder="Role or title"
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
                placeholder="How you met, in a sentence"
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
                      placeholder="Career fair, a class, a flight…"
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
                      placeholder="Industry"
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
                      placeholder="School"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gradYear">Grad year</Label>
                    <Input
                      id="gradYear"
                      value={form.gradYear}
                      onChange={(e) => set('gradYear', e.target.value)}
                      placeholder="YYYY"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="major">Major / field</Label>
                    <Input
                      id="major"
                      value={form.major}
                      onChange={(e) => set('major', e.target.value)}
                      placeholder="Industry"
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
                      placeholder="name@school.edu"
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

                {/* Tags — suggested from what's already been filled in, so the
                    field that usually gets skipped fills itself. */}
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <TagSelect
                    value={form.tagIds}
                    onChange={(v) => set('tagIds', v)}
                  />
                  <TagSuggestBar
                    subject={form}
                    value={form.tagIds}
                    onChange={(v) => set('tagIds', v)}
                    auto={!editing}
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
                    placeholder="Anything worth remembering. Markdown works."
                    className="min-h-[100px] font-mono text-xs"
                  />
                </div>
              </div>
            )}

          </form>

          <DialogFooter>
            <span className="hidden text-xs text-muted-foreground sm:mr-auto sm:inline">
              {editing ? (
                `Editing ${fullName(contact!)}`
              ) : (
                <>
                  <Plus className="mr-1 inline h-3 w-3" />
                  Quick add — save now, refine later
                </>
              )}
            </span>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!canSave || saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
