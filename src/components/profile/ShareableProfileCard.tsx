import * as React from 'react'
import { toast } from 'sonner'
import { Panel, PanelHeader, PanelSection } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/auth/AuthProvider'
import { readProfile, type ShareProfile } from '@/lib/shareProfile'

const FIELDS: { key: keyof ShareProfile; label: string; placeholder?: string; span?: boolean }[] = [
  { key: 'name', label: 'Name', placeholder: 'Your full name' },
  { key: 'headline', label: 'Headline', placeholder: 'What you study or do' },
  { key: 'company', label: 'Company', placeholder: 'Where you work, if anywhere' },
  { key: 'school', label: 'School', placeholder: 'Your college' },
  { key: 'gradYear', label: 'Grad year', placeholder: 'YYYY' },
  { key: 'major', label: 'Major', placeholder: 'Your major' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', placeholder: 'linkedin.com/in/…', span: true },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@handle' },
  { key: 'website', label: 'Website', placeholder: 'yoursite.com' },
  { key: 'email', label: 'Email', placeholder: 'you@school.edu' },
  { key: 'phone', label: 'Phone', placeholder: 'Optional' },
]

export function ShareableProfileCard() {
  const { user, updateProfile } = useAuth()
  const saved = readProfile(user)
  const [draft, setDraft] = React.useState<ShareProfile>(saved)
  const [saving, setSaving] = React.useState(false)

  const savedKey = JSON.stringify(saved)
  React.useEffect(() => {
    setDraft(readProfile(user))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey])

  function set(key: keyof ShareProfile, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function save() {
    setSaving(true)
    const { error } = await updateProfile(draft)
    setSaving(false)
    if (error) toast.error(error)
    else toast.success('Profile saved')
  }

  const dirty = JSON.stringify(draft) !== savedKey

  return (
    <Panel>
      <PanelHeader
        action={
          <Button size="sm" onClick={() => void save()} disabled={!draft.name.trim() || !dirty} loading={saving}>
            Save
          </Button>
        }
      >
        Shareable profile
      </PanelHeader>
      <PanelSection>
        <p className="mb-3 text-sm text-muted-foreground">
          What people get when they scan your QR code.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.span ? 'sm:col-span-2' : ''}`}>
              <Label htmlFor={`profile-${f.key}`}>{f.label}</Label>
              <Input
                id={`profile-${f.key}`}
                value={draft[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      </PanelSection>
    </Panel>
  )
}
