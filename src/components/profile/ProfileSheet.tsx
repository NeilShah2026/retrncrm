import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  SheetBar,
  SheetBarButton,
} from '@/components/ui/dialog'
import { InsetGroup, InsetInputRow } from '@/components/ui/inset-list'
import { PROFILE_FIELDS, useProfileDraft } from './useProfileDraft'
import type { ShareProfile } from '@/lib/shareProfile'

const GROUPS: { title?: string; keys: (keyof ShareProfile)[] }[] = [
  { keys: ['name', 'headline'] },
  { title: 'Work and school', keys: ['company', 'school', 'gradYear', 'major'] },
  { title: 'Links', keys: ['linkedinUrl', 'twitter', 'website'] },
  { title: 'Contact', keys: ['email', 'phone'] },
]

/** The phone's editor for the profile a QR code hands over. */
export function ProfileSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { draft, set, save, canSave, reset } = useProfileDraft()

  // Reopening starts from what's saved, not from an abandoned edit.
  React.useEffect(() => {
    if (open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const field = (key: keyof ShareProfile) => PROFILE_FIELDS.find((f) => f.key === key)!

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall hideClose padded={false} className="bg-grouped" aria-describedby={undefined}>
        <DialogHeader>
          <SheetBar
            leading={<SheetBarButton close>Cancel</SheetBarButton>}
            title="Your Profile"
            trailing={
              <SheetBarButton
                strong
                disabled={!canSave}
                onClick={() => {
                  void save().then((ok) => ok && onOpenChange(false))
                }}
              >
                Save
              </SheetBarButton>
            }
          />
        </DialogHeader>

        <div className="space-y-6 px-4 pb-8 pt-1">
          <p className="text-ios-subhead px-1 text-muted-foreground">
            What people get when they scan your QR code.
          </p>
          {GROUPS.map((group) => (
            <InsetGroup key={group.title ?? 'main'} title={group.title}>
              {group.keys.map((key, i) => {
                const f = field(key)
                return (
                  <InsetInputRow
                    key={key}
                    label={f.label.replace(' URL', '').replace('X / Twitter', 'X')}
                    value={draft[key] ?? ''}
                    onChange={(v) => set(key, v)}
                    placeholder={f.placeholder ?? ''}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    inputMode={
                      key === 'email'
                        ? 'email'
                        : key === 'phone'
                          ? 'tel'
                          : key === 'gradYear'
                            ? 'numeric'
                            : key === 'linkedinUrl' || key === 'website'
                              ? 'url'
                              : undefined
                    }
                    autoCapitalize={
                      key === 'name' || key === 'company' || key === 'school' || key === 'major'
                        ? 'words'
                        : key === 'headline'
                          ? 'sentences'
                          : 'none'
                    }
                    last={i === group.keys.length - 1}
                  />
                )
              })}
            </InsetGroup>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
