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
  college: '/app/college',
  calendar: '/app/calendar',
  pipeline: '/app/pipeline',
  templates: '/app/templates',
  tags: '/app/tags',
  settings: '/app/settings',
} as const
