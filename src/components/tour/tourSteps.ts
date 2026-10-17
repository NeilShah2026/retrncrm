import { ROUTES } from '@/lib/routes'

export type TourPlacement = 'right' | 'bottom' | 'left' | 'top'

export interface TourStep {
  id: string
  /** The page the step happens on; the tour navigates there first. */
  route: string
  /** Matches `data-tour="…"` on the element to spotlight. */
  target: string
  title: string
  body: string
  placement: TourPlacement
  /** Leave the step out when its element isn't on screen (a hidden feature). */
  optional?: boolean
}

/**
 * The first-run walkthrough: one idea per stop, a sentence or two each.
 *
 * Feedback on the first version of onboarding was that the app was too much
 * to take in at once. So rather than explaining everything up front, this
 * walks through the real pages in the order someone will need them, pointing
 * at the one thing on each that matters first.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'capture',
    route: ROUTES.dashboard,
    target: 'capture',
    title: 'Add people in one line',
    body: 'Type or say who you met — “Maya, Fidelity, career fair” — and Retrn turns it into a contact. The + opens the full form.',
    placement: 'right',
  },
  {
    id: 'next-up',
    route: ROUTES.dashboard,
    target: 'next-up',
    title: 'Your day, in order',
    body: 'Meetings, follow-ups, birthdays and people going quiet, all in one list and sorted for you. Check things off right here.',
    placement: 'right',
  },
  {
    id: 'contacts',
    route: ROUTES.contacts,
    target: 'contacts-import',
    title: 'Everyone you’ve met',
    body: 'Your whole network lives here. Already keep contacts in a spreadsheet? Import it in any layout and check every row before it’s saved.',
    placement: 'bottom',
  },
  {
    id: 'inbox',
    route: ROUTES.inbox,
    target: 'nav-inbox',
    title: 'Nothing slips',
    body: 'Follow-ups that are due and meetings to write up collect in your Inbox, so you always know what’s waiting on you.',
    placement: 'right',
  },
  {
    id: 'pipeline',
    route: ROUTES.pipeline,
    target: 'nav-pipeline',
    title: 'Track applications',
    body: 'Move internships and jobs through stages, and link the people who can help you get each one.',
    placement: 'right',
  },
  {
    id: 'cold-email',
    route: ROUTES.coldEmail,
    target: 'nav-cold-email',
    title: 'Reach people you haven’t met',
    body: 'Draft cold emails, log when you send them, and Retrn reminds you when it’s time to follow up.',
    placement: 'right',
    optional: true,
  },
  {
    id: 'assistant',
    route: ROUTES.assistant,
    target: 'nav-assistant',
    title: 'Ask your network',
    body: 'Ask “Who do I know in fintech?” or say “I had coffee with Sam today” and the assistant finds people or logs it for you.',
    placement: 'right',
  },
  {
    id: 'search',
    route: ROUTES.dashboard,
    target: 'search',
    title: 'Jump anywhere',
    body: 'Find a person or run a command from any page. Press ⌘K (Ctrl K on Windows) to open it.',
    placement: 'right',
  },
  {
    id: 'settings',
    route: ROUTES.settings,
    target: 'nav-settings',
    title: 'You’re all set',
    body: 'Imports, privacy and your plan live in Settings — and you can take this tour again from there any time.',
    placement: 'right',
  },
]
