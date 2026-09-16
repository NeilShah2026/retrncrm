import { Panel, PanelHeader, PanelSection } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PROFILE_FIELDS, useProfileDraft } from './useProfileDraft'

export function ShareableProfileCard() {
  const { draft, set, save, saving, canSave } = useProfileDraft()

  return (
    <Panel>
      <PanelHeader
        action={
          <Button size="sm" onClick={() => void save()} disabled={!canSave} loading={saving}>
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
          {PROFILE_FIELDS.map((f) => (
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
