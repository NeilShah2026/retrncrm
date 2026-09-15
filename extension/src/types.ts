/** Someone on the page: an email participant or a LinkedIn member. */
export interface Person {
  name: string
  email?: string
  linkedinUrl?: string
  headline?: string
}

export type MailProvider = 'gmail' | 'outlook'

/** An open email thread, read from the Gmail or Outlook page. */
export interface EmailContext {
  kind: 'email'
  provider: MailProvider
  subject: string
  /** A link that reopens this thread. */
  link: string
  /**
   * A stable id for the thread, independent of which folder it was opened
   * from. Stored inside the interaction's link, and used to tell whether this
   * email has already been logged.
   */
  threadKey: string
  /** The newest message's date (yyyy-mm-dd), when the page shows one. */
  date?: string
  /** Addresses the page identifies as the signed-in mailbox. */
  me: string[]
  participants: Person[]
  /** Address that sent the newest message. */
  lastFrom?: string
  /** The newest message's text, quoted replies removed, trimmed. */
  snippet?: string
}

export interface LinkedInProfileContext {
  kind: 'linkedin-profile'
  person: Person
  link: string
}

export interface LinkedInMessageContext {
  kind: 'linkedin-message'
  person: Person
  link: string
}

export type PageContext = EmailContext | LinkedInProfileContext | LinkedInMessageContext

/** Messages over the private channel between the mail page and its panel. */
export type PanelMessage =
  | { type: 'retrn:context-request' }
  | { type: 'retrn:context'; context: PageContext | null; host: string }
  | { type: 'retrn:describe-request' }
  | { type: 'retrn:describe'; details: unknown }
  | { type: 'retrn:close' }
  | { type: 'retrn:logged' }

/** One-off runtime messages (popup → content script, content script → worker). */
export type RuntimeMessage =
  | { type: 'retrn:context-request' }
  | { type: 'retrn:describe-request' }
  | { type: 'retrn:status'; emails: string[]; threadKey: string }
  | { type: 'retrn:refresh-status' }

export interface ThreadStatus {
  signedIn: boolean
  /** How many people on the thread are already contacts. */
  known: number
  /** Whether this thread is already logged to any of them. */
  logged: boolean
}
