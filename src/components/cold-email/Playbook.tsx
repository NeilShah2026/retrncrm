import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * How to cold email, for someone who has never sent one. Written as advice
 * from a student who does this, not as rules: specific examples over
 * principles, and no numbers we can't stand behind — there are no made-up
 * reply rates anywhere on this page.
 */

const SECTIONS = [
  { id: 'who', title: 'Who to write to' },
  { id: 'why', title: 'Find your reason' },
  { id: 'write', title: 'What to write' },
  { id: 'avoid', title: 'The version that gets ignored' },
  { id: 'follow-up', title: 'Following up' },
  { id: 'reply', title: 'When they reply' },
  { id: 'mistakes', title: 'Mistakes that cost replies' },
] as const

export function Playbook({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex max-w-5xl gap-12 pb-12">
      <nav aria-label="On this page" className="sticky top-0 hidden w-44 shrink-0 self-start pt-1 lg:block">
        <p className="text-label text-muted-foreground">Playbook</p>
        <ol className="mt-3 space-y-1.5">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex gap-2 rounded-sm text-sm text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="tnum w-3 text-muted-foreground">{i + 1}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="min-w-0 max-w-2xl flex-1">
        <header className="pb-8">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">How to cold email someone</h2>
          <p className="mt-3 text-base leading-relaxed text-text-secondary">
            A cold email is a short note to someone you haven’t met, asking for a little of their time.
            Most people who could help you are happy to — they just need a reason to open it, a reason
            it’s them, and an ask small enough to say yes to between meetings. That’s the whole craft.
          </p>
        </header>

        <Section n={1} id="who" title="Who to write to">
          <Bullets
            items={[
              <>
                <strong>People two to five years ahead of you.</strong> They remember being where you
                are, and they’re not buried in these the way senior people are.
              </>,
              <>
                <strong>Alumni of your school.</strong> The shared school is a reason on its own, and
                it’s the one most likely to get opened.
              </>,
              <>
                <strong>The role you want, not the most senior title.</strong> An analyst on the team
                can tell you what the job is really like; a managing director gets hundreds of these.
              </>,
              <>
                <strong>Founders and early employees at small companies.</strong> They often read their
                own inbox.
              </>,
            ]}
          />
          <P>
            For the address: check the company site, anything they’ve published or spoken at, and the
            contact info on their LinkedIn. If you have to work it out from the company’s pattern —
            first.last@, say — some will bounce. That’s fine; try the next pattern.
          </P>
        </Section>

        <Section n={2} id="why" title="Find your reason">
          <P>
            The line that gets a reply is the one that could only have been written to them. Before you
            write anything, find one specific thing:
          </P>
          <Bullets
            items={[
              'A move they made — from consulting into product, from a big bank to a startup.',
              'Something they wrote, built, or said on a panel.',
              'Something you share: the same major, club, hometown or first job.',
            ]}
          />
          <P>
            Specific beats flattering. “You moved from consulting into product at Fidelity” works;
            “I really admire your career” could have been sent to anyone, so it reads that way.
          </P>
          <P>
            Can’t find anything? Their role is a reason: “You’re a product manager at a fintech, which
            is the job I’m trying to understand.” Plain and true is fine. Put it in{' '}
            <strong>Why them?</strong> — it’s what your draft gets built around.
          </P>
        </Section>

        <Section n={3} id="write" title="What to write">
          <P>Under 120 words. Five parts, in this order:</P>
          <Anatomy
            subject="Babson sophomore — your move into product"
            parts={[
              { label: 'Who you are', text: 'Hi Dana, I’m a sophomore at Babson studying business analytics.' },
              {
                label: 'Why them',
                text: 'I saw you moved from consulting into product at Fidelity two years ago — that’s exactly the switch I’m weighing before I apply for internships this fall.',
              },
              { label: 'The ask', text: 'Would you have 15 minutes in the next few weeks to tell me how you made it?' },
              { label: 'The easy out', text: 'If now isn’t a good time, I completely understand.' },
              { label: 'Sign-off', text: 'Thanks,\nSam' },
            ]}
          />
          <Bullets
            items={[
              <>
                <strong>Subject:</strong> specific, under eight words. Your school or your reason.
                Never “Quick question”.
              </>,
              <>
                <strong>One ask.</strong> Fifteen minutes on a call, or two questions over email.
                Something they can say yes to without thinking about it.
              </>,
              <>
                <strong>No résumé</strong> unless they ask. It turns a conversation into an application.
              </>,
            ]}
          />
        </Section>

        <Section n={4} id="avoid" title="The version that gets ignored">
          <div className="rounded-lg border bg-bg-sunken/50 p-4 text-sm leading-relaxed text-text-secondary">
            <p className="text-xs font-medium text-muted-foreground">Subject: Quick question</p>
            <p className="mt-3">
              Hi, I hope this email finds you well! My name is Sam and I am a student at Babson College. I
              am very interested in finance and I really admire your impressive career. I was wondering if
              you know of any internship opportunities at your company, or if you could refer me? I have
              attached my résumé. Thank you so much for your time!!
            </p>
          </div>
          <Bullets
            items={[
              'The subject gives no reason to open it.',
              'The first two sentences say nothing they couldn’t guess.',
              '“Admire your impressive career” could go to anyone — so it feels like it went to everyone.',
              'It asks a stranger for a job and a referral. They can’t vouch for someone they’ve never spoken to.',
              'There’s no small, specific thing to say yes to.',
            ]}
          />
        </Section>

        <Section n={5} id="follow-up" title="Following up">
          <P>
            No reply usually means buried, not no. People mean to answer and then the week happens. A
            short follow-up is normal, and it’s often the email that gets the answer.
          </P>
          <Bullets
            items={[
              <>
                <strong>Wait five days</strong>, then reply on the same thread so your first email is
                right underneath.
              </>,
              <>
                <strong>Two or three sentences.</strong> Restate the ask. Don’t apologise for writing
                again, and don’t guilt them with “just bumping this”.
              </>,
              <>
                <strong>One more a week later, then stop.</strong> Two follow-ups is persistent; a
                third reads as pressure. Try someone else at the company instead.
              </>,
            ]}
          />
          <P>Retrn schedules both follow-ups when you log a send, and puts them in your Inbox when they’re due.</P>
        </Section>

        <Section n={6} id="reply" title="When they reply">
          <Bullets
            items={[
              'Answer the same day if you can. Offer two or three specific times with your time zone, or a scheduling link.',
              'Prepare three or four questions: how they got there, what they’d do in your position, what they wish they’d known.',
              'End on time. If it’s going well, they’ll offer more.',
              'Before you hang up, ask: “Is there anyone else you think I should talk to?”',
              'Send a thank-you that evening that mentions one thing you’ll act on.',
            ]}
          />
          <P>
            Then make them a contact in Retrn, so your emails move with them and you remember to check
            in — the person who helped once is usually the one who’ll refer you later.
          </P>
        </Section>

        <Section n={7} id="mistakes" title="Mistakes that cost replies" last>
          <Bullets
            items={[
              'Asking for a job or a referral in the first email.',
              'Emailing five people at one company on the same day. They talk to each other.',
              'Getting their name or their company wrong. Check both before you send.',
              'Following up after a day. Give it five.',
              'Giving up after one email.',
              'A wall of text. If it doesn’t fit on a phone screen without scrolling, cut it.',
            ]}
          />
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border p-4">
            <p className="min-w-0 flex-1 text-sm text-text-secondary">
              Pick one person you could write to this week. Add them, write down why them, and start there.
            </p>
            <Button onClick={onStart}>
              <Plus />
              Add someone
            </Button>
          </div>
        </Section>
      </article>
    </div>
  )
}

function Section({
  n,
  id,
  title,
  last,
  children,
}: {
  n: number
  id: string
  title: string
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn('scroll-mt-4 border-t py-8', last && 'pb-0')}>
      <p className="tnum text-label text-muted-foreground">{String(n).padStart(2, '0')}</p>
      <h3 className="mt-1 text-lg font-semibold">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed text-text-secondary">{children}</p>
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 text-base leading-relaxed text-text-secondary">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span className="min-w-0 [&_strong]:font-medium [&_strong]:text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** A real email, taken apart: each line beside the job it does. */
function Anatomy({ subject, parts }: { subject: string; parts: { label: string; text: string }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex gap-4 border-b bg-bg-sunken/50 px-4 py-2.5">
        <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">Subject</span>
        <span className="min-w-0 text-sm font-medium">{subject}</span>
      </div>
      {parts.map((p) => (
        <div key={p.label} className="flex gap-4 border-b px-4 py-2.5 last:border-b-0">
          <span className="w-24 shrink-0 pt-px text-xs font-medium text-muted-foreground">{p.label}</span>
          <span className="min-w-0 whitespace-pre-line text-sm leading-relaxed">{p.text}</span>
        </div>
      ))}
    </div>
  )
}
