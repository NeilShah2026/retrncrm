import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  Briefcase,
  Users,
  Plus,
  Pencil,
  ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { CollegePicker } from '@/components/college/CollegePicker'
import { CollegeQuickAddDialog } from '@/components/college/CollegeQuickAddDialog'
import { useContacts } from '@/hooks/useData'
import { useAuth } from '@/auth/AuthProvider'
import { fullName } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

type Role = 'professor' | 'alumni' | 'student'

/** Normalize a school name for loose matching against free-text entries. */
function normSchool(s?: string): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const GROUPS: {
  role: Role
  label: string
  icon: typeof Users
  match: (c: Contact) => boolean
}[] = [
  {
    role: 'professor',
    label: 'Professors',
    icon: GraduationCap,
    match: (c) => c.connectionType === 'professor',
  },
  {
    role: 'alumni',
    label: 'Alumni',
    icon: Briefcase,
    match: (c) => c.connectionType === 'alumni',
  },
  {
    role: 'student',
    label: 'Students',
    icon: Users,
    match: (c) => c.connectionType === 'classmate' || c.connectionType === 'peer',
  },
]

export function CollegePage() {
  const { user, updateCollege } = useAuth()
  const contacts = useContacts()
  const college = (user?.user_metadata?.college as string | undefined) ?? ''

  const [addOpen, setAddOpen] = React.useState(false)
  const [addRole, setAddRole] = React.useState<Role>('alumni')
  const [changing, setChanging] = React.useState(false)

  function openAdd(role: Role) {
    setAddRole(role)
    setAddOpen(true)
  }

  // People whose school matches the chosen college.
  const atCollege = React.useMemo(() => {
    if (!college || !contacts) return []
    const target = normSchool(college)
    return contacts.filter((c) => normSchool(c.school) === target)
  }, [contacts, college])

  // ---- No college chosen yet ----
  if (!college) {
    return (
      <PageShell header={<PageHeader title="College" description="Your campus network, in one place." />}>
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">
            Choose your college
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick your school to start tracking professors, alumni, and students
            in your campus network. You can change it anytime.
          </p>
          <div className="mt-6 w-full">
            <CollegePicker
              onSelect={(c) => void updateCollege(c)}
              placeholder="Search for your college…"
            />
          </div>
        </div>
      </PageShell>
    )
  }

  const groupCounts = GROUPS.map((g) => atCollege.filter(g.match).length)
  const uncategorized = atCollege.filter(
    (c) => !GROUPS.some((g) => g.match(c)),
  )

  return (
    <PageShell
      header={
        <PageHeader title={college} description={`${atCollege.length} in your campus network`}>
          {changing ? (
            <div className="w-64">
              <CollegePicker
                value={college}
                onSelect={(c) => {
                  void updateCollege(c)
                  setChanging(false)
                }}
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setChanging(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Change
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => openAdd('alumni')}>
            <Plus className="h-4 w-4" />
            Add person
          </Button>
        </PageHeader>
      }
    >
      <div className="space-y-8">
        {GROUPS.map((group, i) => {
          const people = atCollege.filter(group.match)
          return (
            <section key={group.role}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <group.icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {groupCounts[i]}
                  </span>
                </div>
                <button
                  onClick={() => openAdd(group.role)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>

              {people.length === 0 ? (
                <button
                  onClick={() => openAdd(group.role)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-sm text-muted-foreground transition-colors hover:border-solid hover:bg-accent/50"
                >
                  <Plus className="h-4 w-4" />
                  Add the first {group.label.toLowerCase().replace(/s$/, '')}
                </button>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {people.map((c) => (
                    <PersonRow key={c.id} contact={c} />
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {uncategorized.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Others at {college}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {uncategorized.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {uncategorized.map((c) => (
                <PersonRow key={c.id} contact={c} />
              ))}
            </div>
          </section>
        )}
      </div>

      <CollegeQuickAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        college={college}
        initialRole={addRole}
      />
    </PageShell>
  )
}

function PersonRow({ contact }: { contact: Contact }) {
  const subtitle = [
    contact.jobTitle,
    contact.company,
    contact.major,
    contact.gradYear && `’${contact.gradYear.slice(-2)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to={ROUTES.contact(contact.id)}
      className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:bg-accent"
    >
      <ContactAvatar contact={contact} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fullName(contact)}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}
