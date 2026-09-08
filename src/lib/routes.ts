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
  app: '/app',
  dashboard: '/app',
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
  settings: '/app/settings',
} as const
