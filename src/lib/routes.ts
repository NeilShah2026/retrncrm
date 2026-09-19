/**
 * Centralized route paths. The product lives under /app; "/" is the public
 * marketing site. Keeping paths here (instead of scattering raw strings)
 * means the app-root prefix only has to change in one place.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  add: '/add',
  privacy: '/privacy',
  terms: '/terms',
  /** Where the Babson verification email's link lands. Public on purpose. */
  verifyEdu: '/verify-edu',
  app: '/app',
  dashboard: '/app',
  /** Everything waiting on you: follow-ups due, meetings to write up… */
  inbox: '/app/inbox',
  contacts: '/app/contacts',
  contact: (id: string) => `/app/contacts/${id}`,
  contactsSearch: (q: string) => `/app/contacts?q=${encodeURIComponent(q)}`,
  contactsOverdue: '/app/contacts?overdue=1',
  assistant: '/app/assistant',
  college: '/app/college',
  calendar: '/app/calendar',
  /** Opens the calendar with the new-meeting form already up. */
  calendarNew: '/app/calendar?new=1',
  pipeline: '/app/pipeline',
  /** Opens the board with the new-opportunity form already up. */
  pipelineNew: '/app/pipeline?new=1',
  templates: '/app/templates',
  /** Opens the templates page with the compose dialog on one template. */
  templateUse: (id: string) => `/app/templates?use=${encodeURIComponent(id)}`,
  tags: '/app/tags',
  /** Your profile as a QR code, and the camera to scan someone else's. */
  qr: '/app/qr',
  /** Everything that doesn't fit on the phone's tab bar. */
  more: '/app/more',
  /** First-run onboarding, and the "run it again" entry in Settings. */
  onboarding: '/app/welcome',
  /** Plans, prices, and where a subscription is bought and restored. */
  subscription: '/app/subscription',
  settings: '/app/settings',
} as const
