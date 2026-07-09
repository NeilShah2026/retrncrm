import * as React from 'react'
import { toast } from 'sonner'
import { GraduationCap, Briefcase, Users } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { contactRepo } from '@/services'
import { cn } from '@/lib/utils'
import type { ConnectionType } from '@/types'

type Role = 'professor' | 'alumni' | 'student'

const ROLES: { key: Role; label: string; icon: typeof Users }[] = [
  { key: 'professor', label: 'Professor', icon: GraduationCap },
  { key: 'alumni', label: 'Alum', icon: Briefcase },
  { key: 'student', label: 'Student', icon: Users },
]

/** College role → the shared Contact connectionType. */
const ROLE_TO_CONNECTION: Record<Role, ConnectionType> = {
  professor: 'professor',
  alumni: 'alumni',
  student: 'classmate',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  college: string
  /** Pre-select a role when opening (e.g. from a section's "add" button). */
  initialRole?: Role
}

export function CollegeQuickAddDialog({
  open,
  onOpenChange,
  college,
  initialRole = 'alumni',
}: Props) {
  const [role, setRole] = React.useState<Role>(initialRole)
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [company, setCompany] = React.useState('')
  const [jobTitle, setJobTitle] = React.useState('')
  const [department, setDepartment] = React.useState('')
  const [gradYear, setGradYear] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  // Reset the form whenever the dialog (re)opens.
  React.useEffect(() => {
    if (open) {
      setRole(initialRole)
      setFirstName('')
      setLastName('')
      setEmail('')
      setCompany('')
      setJobTitle('')
      setDepartment('')
      setGradYear('')
    }
  }, [open, initialRole])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return
    setSaving(true)
    try {
      await contactRepo.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        company: role === 'alumni' ? company.trim() || undefined : undefined,
        jobTitle: role === 'alumni' ? jobTitle.trim() || undefined : undefined,
        major: role !== 'alumni' ? department.trim() || undefined : undefined,
        gradYear: role !== 'professor' ? gradYear.trim() || undefined : undefined,
        connectionType: ROLE_TO_CONNECTION[role],
        school: college,
        source: 'class',
        otherLinks: [],
        tagIds: [],
        relationshipStrength: 3,
        contactFrequencyGoal: 'none',
      })
      toast.success(`Added ${firstName.trim()} to ${college}`)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Could not add this person.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to {college}</DialogTitle>
          <DialogDescription>
            They'll show up here and in your Contacts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role segmented control */}
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition-colors',
                  role === r.key
                    ? 'border-indigo-400 bg-indigo-500/10 text-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <r.icon className="h-4 w-4" />
                {r.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-first">First name</Label>
              <Input
                id="qa-first"
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jordan"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-last">Last name</Label>
              <Input
                id="qa-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lee"
              />
            </div>
          </div>

          {/* Role-specific fields */}
          {role === 'alumni' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qa-company">Company</Label>
                <Input
                  id="qa-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Stripe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-title">Role</Label>
                <Input
                  id="qa-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
            </div>
          )}

          {role === 'professor' && (
            <div className="space-y-1.5">
              <Label htmlFor="qa-dept">Department</Label>
              <Input
                id="qa-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Computer Science"
              />
            </div>
          )}

          {role === 'student' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qa-major">Major</Label>
                <Input
                  id="qa-major"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Economics"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-grad">Grad year</Label>
                <Input
                  id="qa-grad"
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  placeholder="2027"
                />
              </div>
            </div>
          )}

          {role === 'alumni' && (
            <div className="space-y-1.5">
              <Label htmlFor="qa-grad-alum">Grad year</Label>
              <Input
                id="qa-grad-alum"
                value={gradYear}
                onChange={(e) => setGradYear(e.target.value)}
                placeholder="2021"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qa-email">Email (optional)</Label>
            <Input
              id="qa-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@example.com"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !firstName.trim()}>
              {saving ? 'Adding…' : 'Add person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
