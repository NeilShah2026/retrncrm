/**
 * The facts both legal documents lean on, kept in one place so the Privacy
 * Policy and Terms can never disagree about who we are or how to reach us.
 * Bump `effectiveDate` whenever either document changes materially.
 */
export const LEGAL = {
  effectiveDate: 'September 14, 2026',
  operator: 'Neil Shah',
  governingState: 'Massachusetts',
  site: 'retrncrm.com',
  emails: {
    hello: 'hello@retrncrm.com',
    privacy: 'privacy@retrncrm.com',
    billing: 'billing@retrncrm.com',
  },
} as const
