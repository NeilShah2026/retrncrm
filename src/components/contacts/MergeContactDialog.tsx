import * as React from 'react'
import { toast } from 'sonner'
import { Search, ArrowRight, Merge } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { useContacts } from '@/hooks/useData'
import { contactRepo } from '@/services'
import { fullName } from '@/lib/format'
import { buildMergePatch } from '@/lib/mergeContacts'
import type { Contact } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The contact that is kept — the other is merged into it and deleted. */
  primary: Contact
}

export function MergeContactDialog({ open, onOpenChange, primary }: Props) {
  const contacts = useContacts() ?? []
  const [query, setQuery] = React.useState('')
  const [dup, setDup] = React.useState<Contact | null>(null)
  const [merging, setMerging] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setDup(null)
    }
  }, [open])

  const candidates = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts
      .filter((c) => c.id !== primary.id)
      .filter((c) =>
        !q
          ? true
          : `${fullName(c)} ${c.company ?? ''} ${c.email ?? ''}`
              .toLowerCase()
              .includes(q),
      )
      .slice(0, 40)
  }, [contacts, primary.id, query])

  async function doMerge() {
    if (!dup) return
    setMerging(true)
    try {
      await contactRepo.update(primary.id, buildMergePatch(primary, dup))
      await contactRepo.remove(dup.id)
      toast.success(`Merged ${fullName(dup)} into ${fullName(primary)}`)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not merge these contacts.')
    } finally {
      setMerging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge a duplicate into {fullName(primary)}</DialogTitle>
          <DialogDescription>
            The other contact's details, tags, and interaction history are
            combined into {primary.firstName}, then the duplicate is removed.
          </DialogDescription>
        </DialogHeader>

        {dup ? (
          // Confirm step
          <div>
            <div className="flex items-center justify-center gap-3 rounded-xl border p-4">
              <div className="flex flex-col items-center gap-1 text-center">
                <ContactAvatar contact={dup} className="h-10 w-10 text-sm" />
                <span className="max-w-[8rem] truncate text-xs text-muted-foreground">
                  {fullName(dup)}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col items-center gap-1 text-center">
                <ContactAvatar contact={primary} className="h-10 w-10 text-sm" />
                <span className="max-w-[8rem] truncate text-xs font-medium">
                  {fullName(primary)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              This can't be undone. {fullName(dup)} will be deleted.
            </p>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setDup(null)} disabled={merging}>
                Back
              </Button>
              <Button onClick={() => void doMerge()} disabled={merging} className="gap-1.5">
                <Merge className="h-4 w-4" />
                {merging ? 'Merging…' : 'Merge contacts'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Pick step
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the duplicate contact…"
                className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
              {candidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No other contacts to merge.
                </p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setDup(c)}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <ContactAvatar contact={c} className="h-8 w-8 shrink-0 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{fullName(c)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.company, c.email].filter(Boolean).join(' · ') || 'No details'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
