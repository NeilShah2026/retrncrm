import * as React from 'react'
import { toast } from 'sonner'
import { QrCode } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/auth/AuthProvider'
import { readProfile, type ShareProfile } from '@/lib/shareProfile'

const FIELDS: {
  key: keyof ShareProfile
  label: string
  placeholder?: string
  span?: boolean
}[] = [
  { key: 'name', label: 'Name', placeholder: 'Jordan Lee' },
  { key: 'headline', label: 'Headline / title', placeholder: 'CS student · aspiring PM' },
  { key: 'company', label: 'Company', placeholder: 'Stripe' },
  { key: 'school', label: 'School', placeholder: 'Babson College' },
  { key: 'gradYear', label: 'Grad year', placeholder: '2027' },
  { key: 'major', label: 'Major', placeholder: 'Economics' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', placeholder: 'linkedin.com/in/you', span: true },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@you' },
  { key: 'website', label: 'Website', placeholder: 'yoursite.com' },
  { key: 'email', label: 'Email', placeholder: 'you@school.edu' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567' },
]

export function ShareableProfileCard() {
  const { user, updateProfile } = useAuth()
  const saved = readProfile(user)
  const [draft, setDraft] = React.useState<ShareProfile>(saved)
  const [saving, setSaving] = React.useState(false)

  // Re-sync when the saved profile changes (e.g. metadata refresh).
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
    <Card>
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          <h2 className="font-semibold">Your shareable profile</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          This is what people get when they scan your QR code from the sidebar.
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

        <div className="mt-4 flex justify-end">
          <Button onClick={() => void save()} disabled={saving || !draft.name.trim() || !dirty}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
