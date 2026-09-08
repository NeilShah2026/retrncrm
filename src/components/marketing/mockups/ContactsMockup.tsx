import { MockAvatar, MockSurface, MockTag } from './primitives'

interface Person {
  name: string
  role: string
  company: string
  tags: { label: string; tone: 'blue' | 'green' | 'amber' | 'teal' | 'slate' }[]
  last: string
  cadence: string
}

const PEOPLE: Person[] = [
  { name: 'David Osei', role: 'Co-founder', company: 'Vanta', tags: [{ label: 'founder', tone: 'blue' }, { label: 'mentor', tone: 'teal' }], last: '3mo', cadence: 'Quarterly' },
  { name: 'Priya Nair', role: 'Product Manager', company: 'Figma', tags: [{ label: 'recruiter', tone: 'green' }], last: '2w', cadence: 'Monthly' },
  { name: 'Marcus Chen', role: 'Software Engineer', company: 'Stripe', tags: [{ label: 'referral', tone: 'amber' }], last: '5d', cadence: '—' },
  { name: 'Grace Liu', role: 'Scout', company: 'Sequoia', tags: [{ label: 'investor', tone: 'slate' }], last: '9mo', cadence: 'Quarterly' },
]

/** The contacts table, plus the one-line capture bar above it. */
export function ContactsMockup() {
  return (
    <MockSurface className="w-full">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex h-7 flex-1 items-center rounded-md border px-2 text-[12px] text-muted-foreground">
          Sarah Chen, PM at Fidelity, career fair, follow up in a month
        </span>
        <span className="flex h-7 items-center rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground">
          Save contact
        </span>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="h-7 bg-bg-sunken text-left text-[11px] text-muted-foreground [&>th]:border-b [&>th]:px-3 [&>th]:font-medium">
            <th>Name</th>
            <th>Company</th>
            <th className="hidden sm:table-cell">Tags</th>
            <th>Last</th>
            <th className="hidden sm:table-cell">Cadence</th>
          </tr>
        </thead>
        <tbody>
          {PEOPLE.map((p) => (
            <tr key={p.name} className="h-9 border-b last:border-b-0 [&>td]:px-3">
              <td>
                <span className="flex items-center gap-2">
                  <MockAvatar name={p.name} size={20} />
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="hidden truncate text-muted-foreground lg:inline">{p.role}</span>
                </span>
              </td>
              <td className="text-text-secondary">{p.company}</td>
              <td className="hidden sm:table-cell">
                <span className="flex gap-1">
                  {p.tags.map((t) => (
                    <MockTag key={t.label} tone={t.tone}>
                      {t.label}
                    </MockTag>
                  ))}
                </span>
              </td>
              <td className="tnum text-text-secondary">{p.last}</td>
              <td className="hidden text-text-secondary sm:table-cell">{p.cadence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MockSurface>
  )
}
