import { MockAvatar, MockHeader, MockSurface } from './primitives'

const BRIEF = [
  'Last spoke 3 months ago, at the MIT hackathon',
  'Ask about the move to the Vanta founding team',
  'You both know Priya from the Figma career fair',
]

/** A prep brief and the outreach it leads to, both as plain product UI. */
export function ComposeMockup() {
  return (
    <MockSurface className="w-full">
      <div className="flex items-center gap-2.5 border-b px-3 py-2">
        <MockAvatar name="David Osei" size={24} />
        <div className="min-w-0">
          <p className="text-[12px] font-medium leading-tight">David Osei</p>
          <p className="text-[11px] text-muted-foreground">Coffee chat request</p>
        </div>
      </div>

      <MockHeader action="Suggested">Before you write</MockHeader>
      <ul className="px-3 py-2">
        {BRIEF.map((line) => (
          <li key={line} className="flex items-start gap-2 py-1 text-[12px] text-text-secondary">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-border-strong" />
            {line}
          </li>
        ))}
      </ul>

      <div className="border-t px-3 py-3 text-[12px] leading-relaxed">
        <p>
          Hi <span className="rounded-sm bg-bg-sunken px-1">David</span>, good to meet you at{' '}
          <span className="rounded-sm bg-bg-sunken px-1">the MIT hackathon</span>.
        </p>
        <p className="mt-1 text-text-secondary">
          I’d like to hear more about your work at Vanta. Any chance you’re free for a quick coffee?
        </p>
      </div>
    </MockSurface>
  )
}
