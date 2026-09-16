import * as React from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SheetBar,
  SheetBarButton,
} from '@/components/ui/dialog'
import {
  InsetDateRow,
  InsetGroup,
  InsetInputRow,
  InsetRow,
  InsetSelectRow,
  InsetTextareaRow,
} from '@/components/ui/inset-list'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts } from '@/hooks/useData'
import { useIsMobile } from '@/hooks/useIsMobile'
import { fullName } from '@/lib/format'
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
import { ContactMultiSelect } from '@/components/contacts/ContactMultiSelect'
import { opportunityRepo } from '@/services'
import {
  OPPORTUNITY_OUTCOMES,
  OPPORTUNITY_OUTCOME_KEYS,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_KEYS,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_TYPE_KEYS,
} from '@/lib/constants'
import type {
  Opportunity,
  OpportunityOutcome,
  OpportunityStage,
  OpportunityType,
} from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunity?: Opportunity | null
  /** Stage to default a brand-new card into. */
  defaultStage?: OpportunityStage
}

interface FormState {
  company: string
  role: string
  type: OpportunityType
  stage: OpportunityStage
  outcome: OpportunityOutcome | ''
  location: string
  link: string
  deadline: string
  appliedDate: string
  notes: string
  contactIds: string[]
}

function initialState(
  o?: Opportunity | null,
  defaultStage?: OpportunityStage,
): FormState {
  return {
    company: o?.company ?? '',
    role: o?.role ?? '',
    type: o?.type ?? 'internship',
    stage: o?.stage ?? defaultStage ?? 'researching',
    outcome: o?.outcome ?? '',
    location: o?.location ?? '',
    link: o?.link ?? '',
    deadline: o?.deadline ?? '',
    appliedDate: o?.appliedDate ?? '',
    notes: o?.notes ?? '',
    contactIds: o?.contactIds ?? [],
  }
}

const NONE = '__none__'

export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity,
  defaultStage,
}: Props) {
  const editing = Boolean(opportunity)
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(opportunity, defaultStage),
  )
  const [saving, setSaving] = React.useState(false)
  const [contactQuery, setContactQuery] = React.useState('')
  const isMobile = useIsMobile()
  const allContacts = useContacts() ?? []

  React.useEffect(() => {
    if (open) setForm(initialState(opportunity, defaultStage))
  }, [open, opportunity, defaultStage])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!form.company.trim()) {
      toast.error('Company is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        company: form.company.trim(),
        role: form.role.trim() || 'Role TBD',
        type: form.type,
        stage: form.stage,
        outcome:
          form.stage === 'closed' && form.outcome ? form.outcome : undefined,
        location: form.location.trim() || undefined,
        link: form.link.trim() || undefined,
        deadline: form.deadline || undefined,
        appliedDate: form.appliedDate || undefined,
        notes: form.notes.trim() || undefined,
        contactIds: form.contactIds,
      }
      if (opportunity) {
        await opportunityRepo.update(opportunity.id, payload)
        toast.success('Opportunity updated')
      } else {
        await opportunityRepo.create(payload)
        toast.success(`Added ${payload.company} to your pipeline`)
      }
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not save the opportunity.')
    } finally {
      setSaving(false)
    }
  }

  /** The phone's version: grouped rows and the system pickers. */
  function renderPhone() {
    const linked = form.contactIds
      .map((id) => allContacts.find((c) => c.id === id))
      .filter(Boolean) as NonNullable<(typeof allContacts)[number]>[]
    const matches = (() => {
      const q = contactQuery.trim().toLowerCase()
      if (!q) return []
      return allContacts
        .filter((c) => !form.contactIds.includes(c.id))
        .filter((c) => `${fullName(c)} ${c.company ?? ''}`.toLowerCase().includes(q))
        .slice(0, 5)
    })()

    return (
      <DialogContent tall hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
        <DialogHeader>
          <SheetBar
            leading={<SheetBarButton close>Cancel</SheetBarButton>}
            title={editing ? 'Edit Opportunity' : 'New Opportunity'}
            trailing={
              <SheetBarButton
                strong
                disabled={saving || !form.company.trim()}
                onClick={() => void save()}
              >
                {editing ? 'Done' : 'Add'}
              </SheetBarButton>
            }
          />
        </DialogHeader>

        <div className="space-y-6 px-4 pb-8 pt-1">
          <InsetGroup>
            <InsetInputRow
              value={form.company}
              onChange={(v) => set('company', v)}
              placeholder="Company"
              autoCapitalize="words"
            />
            <InsetInputRow
              value={form.role}
              onChange={(v) => set('role', v)}
              placeholder="Role, e.g. Summer analyst"
              autoCapitalize="words"
              last
            />
          </InsetGroup>

          <InsetGroup>
            <InsetSelectRow
              label="Type"
              allowNone={false}
              value={form.type}
              onChange={(v) => set('type', (v || 'internship') as OpportunityType)}
              options={OPPORTUNITY_TYPE_KEYS.map((k) => ({ value: k, label: OPPORTUNITY_TYPES[k] }))}
            />
            <InsetSelectRow
              label="Stage"
              allowNone={false}
              value={form.stage}
              onChange={(v) => set('stage', (v || 'researching') as OpportunityStage)}
              options={OPPORTUNITY_STAGE_KEYS.map((k) => ({
                value: k,
                label: OPPORTUNITY_STAGES[k].label,
              }))}
              last={form.stage !== 'closed'}
            />
            {form.stage === 'closed' && (
              <InsetSelectRow
                label="Outcome"
                value={form.outcome}
                onChange={(v) => set('outcome', v as OpportunityOutcome | '')}
                options={OPPORTUNITY_OUTCOME_KEYS.map((k) => ({
                  value: k,
                  label: OPPORTUNITY_OUTCOMES[k].label,
                }))}
                last
              />
            )}
          </InsetGroup>

          <InsetGroup title="Dates">
            <InsetDateRow
              label="Deadline"
              value={form.deadline || undefined}
              onChange={(v) => set('deadline', v ?? '')}
            />
            <InsetDateRow
              label="Applied on"
              value={form.appliedDate || undefined}
              onChange={(v) => set('appliedDate', v ?? '')}
              last
            />
          </InsetGroup>

          <InsetGroup title="Where and what">
            <InsetInputRow
              label="Location"
              value={form.location}
              onChange={(v) => set('location', v)}
              placeholder="City or remote"
              autoCapitalize="words"
            />
            <InsetInputRow
              label="Link"
              value={form.link}
              onChange={(v) => set('link', v)}
              placeholder="Posting link"
              type="url"
              inputMode="url"
              last
            />
          </InsetGroup>

          <InsetGroup title="People" footer="Whoever can help — a recruiter, a referrer.">
            {linked.map((c) => (
              <InsetRow
                key={c.id}
                leading={<ContactAvatar contact={c} className="h-7 w-7 text-[11px]" />}
                title={fullName(c)}
                chevron={false}
                accessory={<span className="text-ios-subhead text-brand">Remove</span>}
                onClick={() =>
                  set(
                    'contactIds',
                    form.contactIds.filter((id) => id !== c.id),
                  )
                }
              />
            ))}
            <InsetInputRow
              value={contactQuery}
              onChange={setContactQuery}
              placeholder="Search contacts to link…"
              last={matches.length === 0}
            />
            {matches.map((c, i) => (
              <InsetRow
                key={c.id}
                leading={<ContactAvatar contact={c} className="h-7 w-7 text-[11px]" />}
                title={c.company ? `${fullName(c)} · ${c.company}` : fullName(c)}
                chevron={false}
                accessory={<span className="text-ios-subhead text-brand">Add</span>}
                last={i === matches.length - 1}
                onClick={() => {
                  set('contactIds', [...form.contactIds, c.id])
                  setContactQuery('')
                }}
              />
            ))}
          </InsetGroup>

          <InsetGroup title="Notes">
            <InsetTextareaRow
              value={form.notes}
              onChange={(v) => set('notes', v)}
              placeholder="Anything worth remembering about this one"
              rows={3}
              last
            />
          </InsetGroup>
        </div>
      </DialogContent>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isMobile ? renderPhone() : (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit opportunity' : 'New opportunity'}
          </DialogTitle>
          <DialogDescription>
            Track a company or role you're pursuing and link the people who can
            help.
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
              <Label htmlFor="opp-company">Company *</Label>
              <Input
                id="opp-company"
                autoFocus
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Company"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-role">Role</Label>
              <Input
                id="opp-role"
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                placeholder="Role, e.g. Summer analyst"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set('type', v as OpportunityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_TYPE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {OPPORTUNITY_TYPES[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select
                value={form.stage}
                onValueChange={(v) => set('stage', v as OpportunityStage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_STAGE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {OPPORTUNITY_STAGES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.stage === 'closed' && (
              <div className="space-y-1.5">
                <Label>Outcome</Label>
                <Select
                  value={form.outcome || NONE}
                  onValueChange={(v) =>
                    set('outcome', v === NONE ? '' : (v as OpportunityOutcome))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {OPPORTUNITY_OUTCOME_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {OPPORTUNITY_OUTCOMES[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="opp-deadline">Deadline</Label>
              <Input
                id="opp-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-applied">Applied on</Label>
              <Input
                id="opp-applied"
                type="date"
                value={form.appliedDate}
                onChange={(e) => set('appliedDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-location">Location</Label>
              <Input
                id="opp-location"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="City or remote"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-link">Posting link</Label>
              <Input
                id="opp-link"
                value={form.link}
                onChange={(e) => set('link', e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked contacts</Label>
            <ContactMultiSelect
              value={form.contactIds}
              onChange={(v) => set('contactIds', v)}
              placeholder="Link recruiter / referrer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-notes">
              Notes{' '}
              <span className="font-normal text-muted-foreground">
                · markdown
              </span>
            </Label>
            <Textarea
              id="opp-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Anything worth remembering about this one"
              className="min-h-[70px] font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.company.trim()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add opportunity'}
            </Button>
          </div>
        </form>
      </DialogContent>
      )}
    </Dialog>
  )
}
