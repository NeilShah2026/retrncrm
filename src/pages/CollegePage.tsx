import * as React from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Briefcase, Users, Plus, Pencil, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { BarButton } from '@/components/layout/MobileNavBar'
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

function normSchool(s?: string): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const GROUPS: { role: Role; label: string; singular: string; icon: typeof Users; match: (c: Contact) => boolean }[] = [
  { role: 'professor', label: 'Professors', singular: 'professor', icon: GraduationCap, match: (c) => c.connectionType === 'professor' },
  { role: 'alumni', label: 'Alumni', singular: 'alum', icon: Briefcase, match: (c) => c.connectionType === 'alumni' },
  { role: 'student', label: 'Students', singular: 'student', icon: Users, match: (c) => c.connectionType === 'classmate' || c.connectionType === 'peer' },
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

  const atCollege = React.useMemo(() => {
    if (!college || !contacts) return []
    const target = normSchool(college)
    const CAMPUS_ROLES = new Set(['professor', 'alumni', 'classmate', 'peer'])
    return contacts.filter((c) => {
      const s = normSchool(c.school)
      if (s) return s === target
      return c.connectionType ? CAMPUS_ROLES.has(c.connectionType) : false
    })
  }, [contacts, college])

  if (!college) {
    return (
      <PageShell
        mobile={{ title: 'College' }}
        header={<PageHeader title="College" description="Your campus network, in one place." />}
      >
        <div className="mx-auto max-w-md rounded-lg border border-dashed px-6 py-12 text-center">
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border bg-bg-sunken text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
          </span>
          <h2 className="mt-3 text-base font-semibold">Choose your college</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Professors, alumni and classmates get grouped here. You can change it any time.
          </p>
          <div className="mt-5 text-left">
            <CollegePicker onSelect={(c) => void updateCollege(c)} placeholder="Search for your college" />
          </div>
        </div>
      </PageShell>
    )
  }

  const uncategorized = atCollege.filter((c) => !GROUPS.some((g) => g.match(c)))

  return (
    <PageShell
      mobile={{
        title: college,
        subtitle: `${atCollege.length} in your campus network`,
        toolbar: changing ? (
          <CollegePicker
            value={college}
            onSelect={(c) => {
              void updateCollege(c)
              setChanging(false)
            }}
          />
        ) : undefined,
        trailing: (
          <>
            <BarButton onClick={() => setChanging((v) => !v)} aria-label="Change college">
              <Pencil />
            </BarButton>
            <BarButton onClick={() => openAdd('alumni')} aria-label="Add person">
              <Plus strokeWidth={2.4} />
            </BarButton>
          </>
        ),
      }}
      header={
        <PageHeader title={college} description={`${atCollege.length} in your campus network`}>
          {changing ? (
            <div className="w-full sm:w-64">
              <CollegePicker
                value={college}
                onSelect={(c) => {
                  void updateCollege(c)
                  setChanging(false)
                }}
              />
            </div>
          ) : (
            <Button variant="outline" onClick={() => setChanging(true)}>
              <Pencil />
              Change
            </Button>
          )}
          <Button onClick={() => openAdd('alumni')}>
            <Plus />
            Add person
          </Button>
        </PageHeader>
      }
    >
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const people = atCollege.filter(group.match)
          return (
            <section key={group.role}>
              <div className="mb-2 flex h-7 items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <group.icon className="h-4 w-4 text-muted-foreground" />
                  {group.label}
                  <span className="tnum text-xs font-normal text-muted-foreground">{people.length}</span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => openAdd(group.role)} className="text-muted-foreground">
                  <Plus />
                  Add
                </Button>
              </div>

              {people.length === 0 ? (
                <button
                  onClick={() => openAdd(group.role)}
                  className="flex h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors duration-fast hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add the first {group.singular}
                </button>
              ) : (
                <PeopleList people={people} />
              )}
            </section>
          )
        })}

        {uncategorized.length > 0 && (
          <section>
            <h2 className="mb-2 flex h-7 items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Others at {college}
              <span className="tnum text-xs font-normal text-muted-foreground">{uncategorized.length}</span>
            </h2>
            <PeopleList people={uncategorized} />
          </section>
        )}
      </div>

      <CollegeQuickAddDialog open={addOpen} onOpenChange={setAddOpen} college={college} initialRole={addRole} />
    </PageShell>
  )
}

function PeopleList({ people }: { people: Contact[] }) {
  return (
    <ul className="overflow-hidden rounded-lg border bg-card sm:grid sm:grid-cols-2">
      {people.map((c) => (
        <li key={c.id} className="border-b sm:odd:border-r [&:nth-last-child(-n+1)]:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
          <PersonRow contact={c} />
        </li>
      ))}
    </ul>
  )
}

function PersonRow({ contact }: { contact: Contact }) {
  const subtitle = [contact.jobTitle, contact.company, contact.major, contact.gradYear && `’${contact.gradYear.slice(-2)}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to={ROUTES.contact(contact.id)}
      className="group flex h-12 items-center gap-2.5 px-3 transition-colors duration-fast hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
    >
      <ContactAvatar contact={contact} className="h-7 w-7" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{fullName(contact)}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </Link>
  )
}
