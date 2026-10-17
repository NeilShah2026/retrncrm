/**
 * The Retrn fields a spreadsheet column can be matched to.
 *
 * One list drives everything about a spreadsheet import: the columns of the
 * downloadable template (`scripts/build-contact-template.mjs` reads the
 * `template` entries in this order), the header names the rules-based matcher
 * recognises, the field descriptions the AI matcher is given, and the columns
 * of the review table. Add a field here and all four pick it up.
 */

export type ImportField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'linkedinUrl'
  | 'whereWeMet'
  | 'dateMet'
  | 'tags'
  | 'notes'
  | 'school'
  | 'gradYear'
  | 'major'
  | 'industry'
  | 'birthday'
  | 'lastContactDate'
  | 'howWeMet'
  | 'twitter'
  | 'website'

/** A column the import should leave out. */
export const IGNORE = 'ignore' as const
export type ColumnTarget = ImportField | typeof IGNORE

export interface FieldSpec {
  key: ImportField
  /** What the review table and the template call it. */
  label: string
  /** What it means, for the AI matcher. */
  description: string
  /**
   * Header spellings that mean this field, compared after lower-casing and
   * stripping everything but letters and digits ("E-mail Address" → "emailaddress").
   */
  aliases: string[]
  /** Several columns may feed it (their values are joined). */
  multiple?: boolean
  /** In the downloadable template, with this example value. */
  template?: { example: string; width: number; note?: string }
}

export const FIELDS: FieldSpec[] = [
  {
    key: 'firstName',
    label: 'First Name',
    description: 'Given name only',
    aliases: ['firstname', 'first', 'givenname', 'fname', 'forename', 'preferredname', 'vorname', 'prenom', 'nombre'],
    template: { example: 'Maya', width: 16, note: 'Required. Everything else is optional.' },
  },
  {
    key: 'lastName',
    label: 'Last Name',
    description: 'Family name / surname only',
    aliases: ['lastname', 'last', 'surname', 'familyname', 'lname', 'nachname', 'nom', 'apellido', 'apellidos'],
    template: { example: 'Patel', width: 16 },
  },
  {
    key: 'fullName',
    label: 'Full Name',
    description:
      'A whole name in one column ("Maya Patel" or "Patel, Maya"); Retrn splits it into first and last',
    aliases: ['name', 'fullname', 'contact', 'contactname', 'person', 'displayname', 'who'],
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Email address',
    aliases: ['email', 'emailaddress', 'mail', 'workemail', 'personalemail', 'email1', 'primaryemail'],
    template: { example: 'maya.patel@example.com', width: 28 },
  },
  {
    key: 'phone',
    label: 'Phone',
    description: 'Phone number',
    aliases: ['phone', 'phonenumber', 'mobile', 'cell', 'cellphone', 'mobilephone', 'tel', 'telephone', 'number'],
    template: { example: '(617) 555-0142', width: 18 },
  },
  {
    key: 'company',
    label: 'Company',
    description: 'Employer or organisation',
    aliases: ['company', 'companyname', 'organization', 'organisation', 'org', 'employer', 'firm', 'workplace'],
    template: { example: 'Fidelity Investments', width: 22 },
  },
  {
    key: 'jobTitle',
    label: 'Job Title',
    description: 'Role or position',
    aliases: ['jobtitle', 'title', 'role', 'position', 'job', 'designation', 'occupation'],
    template: { example: 'Associate, Equity Research', width: 26 },
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    description: 'LinkedIn profile URL or handle',
    aliases: ['linkedin', 'linkedinurl', 'linkedinprofile', 'li', 'linkedinlink'],
    template: { example: 'linkedin.com/in/mayapatel', width: 28 },
  },
  {
    key: 'whereWeMet',
    label: 'Where We Met',
    description: 'Event or place they met this person (career fair, conference, class…)',
    aliases: ['wherewemet', 'wheremet', 'metat', 'event', 'where', 'location', 'source', 'context'],
    template: { example: 'Fall career fair', width: 22 },
  },
  {
    key: 'dateMet',
    label: 'Date Met',
    description: 'When they first met',
    aliases: ['datemet', 'met', 'metdate', 'firstmet', 'datefirstmet', 'whenmet', 'datewemet', 'connectedon'],
    template: { example: '2026-09-18', width: 14, note: 'Any date format works.' },
  },
  {
    key: 'tags',
    label: 'Tags',
    description: 'Labels or categories for the person, possibly several separated by commas',
    aliases: ['tags', 'tag', 'labels', 'label', 'category', 'categories', 'group', 'groups', 'type'],
    multiple: true,
    template: { example: 'Alumni, Finance', width: 20, note: 'Separate several with commas.' },
  },
  {
    key: 'notes',
    label: 'Notes',
    description: 'Free-text notes, comments or anything that fits no other field',
    aliases: ['notes', 'note', 'comments', 'comment', 'details', 'description', 'remarks', 'info', 'about'],
    multiple: true,
    template: { example: 'Covers fintech. Offered to refer me in spring.', width: 40 },
  },
  {
    key: 'school',
    label: 'School',
    description: 'University or school',
    aliases: ['school', 'university', 'college', 'alma mater', 'almamater', 'education', 'institution'],
    template: { example: 'Babson College', width: 20 },
  },
  {
    key: 'gradYear',
    label: 'Grad Year',
    description: 'Graduation year or class year',
    aliases: ['gradyear', 'graduationyear', 'classyear', 'class', 'year', 'classof', 'grad'],
    template: { example: '2027', width: 11 },
  },
  {
    key: 'major',
    label: 'Major',
    description: 'Field of study',
    aliases: ['major', 'fieldofstudy', 'concentration', 'degree', 'program', 'study'],
  },
  {
    key: 'industry',
    label: 'Industry',
    description: 'Industry or sector they work in',
    aliases: ['industry', 'sector', 'field', 'vertical'],
  },
  {
    key: 'birthday',
    label: 'Birthday',
    description: 'Birthday or date of birth (year optional)',
    aliases: ['birthday', 'birthdate', 'dob', 'dateofbirth', 'bday'],
    template: { example: 'March 3', width: 13, note: 'Year optional.' },
  },
  {
    key: 'lastContactDate',
    label: 'Last Contacted',
    description: 'When they last spoke or were last in touch',
    aliases: ['lastcontacted', 'lastcontact', 'lastcontactdate', 'lastspoke', 'lasttouch', 'lastreachedout', 'lastmet'],
  },
  {
    key: 'howWeMet',
    label: 'How We Met',
    description: 'How they were introduced or connected (intro from a friend, cold email…)',
    aliases: ['howwemet', 'howmet', 'introducedby', 'introduction', 'referral', 'referredby', 'connection'],
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    description: 'X or Twitter handle',
    aliases: ['twitter', 'x', 'twitterhandle', 'xhandle'],
  },
  {
    key: 'website',
    label: 'Website',
    description: 'Personal or company website URL (not LinkedIn)',
    aliases: ['website', 'site', 'url', 'web', 'homepage', 'portfolio'],
  },
]

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<
  ImportField,
  FieldSpec
>

/**
 * The template's example row uses this address, so an import can recognise
 * the row when someone fills in the sheet below it and forgets to delete it.
 */
export const TEMPLATE_EXAMPLE_EMAIL = 'maya.patel@example.com'

/** The template's columns, in order. */
export const TEMPLATE_FIELDS = FIELDS.filter((f) => f.template)

/** A header as the matcher compares it. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}
