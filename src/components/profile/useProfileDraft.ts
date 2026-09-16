import * as React from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { readProfile, type ShareProfile } from '@/lib/shareProfile'

/** The fields of a shareable profile, in the order they're asked for. */
export const PROFILE_FIELDS: {
  key: keyof ShareProfile
  label: string
  placeholder?: string
  span?: boolean
}[] = [
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

/**
 * An editable copy of the signed-in user's shareable profile, shared by the
 * desktop card and the phone's sheet: the same draft, dirty check and save.
 */
export function useProfileDraft() {
  const { user, updateProfile } = useAuth()
  const saved = readProfile(user)
  const [draft, setDraft] = React.useState<ShareProfile>(saved)
  const [saving, setSaving] = React.useState(false)

  const savedKey = JSON.stringify(saved)
  React.useEffect(() => {
    setDraft(readProfile(user))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey])

  const dirty = JSON.stringify(draft) !== savedKey

  function set(key: keyof ShareProfile, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  /** Saves, reporting the outcome; true when it landed. */
  async function save(): Promise<boolean> {
    setSaving(true)
    const { error } = await updateProfile(draft)
    setSaving(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('Profile saved')
    return true
  }

  return {
    draft,
    set,
    save,
    saving,
    dirty,
    canSave: Boolean(draft.name.trim()) && dirty && !saving,
    reset: () => setDraft(readProfile(user)),
  }
}
