import { supabase } from './supabase'
import { RETRN_APP_URLS } from './config'
import {
  findContactByEmail,
  findContactByLinkedin,
  findContactsByName,
  logToExisting,
  updateContact,
  createContact,
  getMyEmail,
  type ContactLite,
} from './db'

const app = document.getElementById('app') as HTMLDivElement

interface Person {
  name: string
  email?: string
  linkedinUrl?: string
  headline?: string
  company?: string
}

type Context =
  | {
      kind: 'email'
      subject: string
      link: string
      /** The email's sent date (yyyy-mm-dd), if we could read it. */
      date?: string
      /** Email addresses detected as the current user's own (to exclude). */
      me?: string[]
      participants: Person[]
    }
  | { kind: 'linkedin-profile'; person: Person; link: string }
  | { kind: 'linkedin-message'; person: Person; link: string }

const INTERACTION_TYPES = [
  'email',
  'call',
  'meeting',
  'coffee',
  'text',
  'event',
  'linkedin',
  'other',
]

// ---------------------------------------------------------------------------
// Page extraction — injected into the active tab. Self-contained (no imports).
// Gmail is well-supported; Outlook & LinkedIn are best-effort and their
// selectors may need updating over time.
// ---------------------------------------------------------------------------
function extractPageContext(): Context | null {
  const host = location.hostname
  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

  // ---------- Gmail ----------
  if (host.includes('mail.google.com')) {
    // Both senders (.gD) and recipients (.g2) carry email/name — capture both,
    // so an email YOU sent still surfaces the person you sent it to.
    const seen = new Set<string>()
    const participants: Person[] = []
    for (const s of Array.from(document.querySelectorAll('span.gD[email], span.g2[email]'))) {
      const email = (s.getAttribute('email') || '').trim()
      if (!email || seen.has(email.toLowerCase())) continue
      seen.add(email.toLowerCase())
      participants.push({
        name: s.getAttribute('name') || s.textContent?.trim() || email,
        email,
      })
    }
    const subject = document.querySelector('h2.hP')?.textContent?.trim() || ''

    // The signed-in Gmail account (may differ from the Retrn account email).
    const acct = document
      .querySelector('[aria-label*="Google Account"]')
      ?.getAttribute('aria-label')
      ?.match(emailRe)?.[0]

    // The sent date of the most recent message in the thread.
    let date = ''
    const dateEls = Array.from(document.querySelectorAll('span.g3[title]'))
    const raw = dateEls[dateEls.length - 1]?.getAttribute('title') || ''
    if (raw) {
      const d = new Date(raw)
      if (!isNaN(d.getTime())) {
        date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10)
      }
    }

    if (participants.length === 0) return null
    return {
      kind: 'email',
      subject,
      link: location.href,
      date,
      me: acct ? [acct] : [],
      participants,
    }
  }

  // ---------- Outlook (best-effort) ----------
  if (host.includes('outlook')) {
    // Sender/recipient chips carry the email in title/aria-label attributes (as
    // opposed to body text), so scan attributes to collect participants.
    const seen = new Set<string>()
    const participants: Person[] = []
    for (const attr of ['aria-label', 'title']) {
      for (const el of Array.from(document.querySelectorAll(`[${attr}]`))) {
        const v = el.getAttribute(attr) ?? ''
        const m = v.match(emailRe)
        if (!m) continue
        const email = m[0]
        if (seen.has(email.toLowerCase())) continue
        seen.add(email.toLowerCase())
        participants.push({
          name: v.replace(email, '').replace(/From\s*|[<>()]/g, '').trim() || email,
          email,
        })
      }
    }
    if (participants.length === 0) {
      const mailto = document.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null
      const e = mailto?.getAttribute('href')?.slice(7).split('?')[0] ?? ''
      if (emailRe.test(e)) participants.push({ name: mailto?.textContent?.trim() || e, email: e })
    }
    if (participants.length === 0) return null

    const subject =
      document.querySelector('[role="main"] [role="heading"]')?.textContent?.trim() ||
      document.title.replace(/\s*[-|].*/, '').trim() ||
      ''

    // Best-effort date: a <time> element or an attribute that parses as a date.
    let date = ''
    const timeRaw =
      document.querySelector('[role="main"] time')?.getAttribute('datetime') ||
      document.querySelector('[role="main"] time')?.textContent ||
      ''
    if (timeRaw) {
      const d = new Date(timeRaw)
      if (!isNaN(d.getTime()))
        date = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10)
    }

    return { kind: 'email', subject, link: location.href, date, me: [], participants }
  }

  // ---------- LinkedIn ----------
  if (host.includes('linkedin.com')) {
    const path = location.pathname
    // "(3) Jordan Lee | LinkedIn"  or  "Jordan Lee - Title | LinkedIn"
    const titleName = document.title
      .replace(/\s*\|\s*LinkedIn.*$/i, '')
      .replace(/^\(\d+\)\s*/, '')
      .split(/ - | \| /)[0]
      .trim()

    // Profile page → add/update the contact.
    if (path.includes('/in/')) {
      const h1 =
        (document.querySelector('.text-heading-xlarge') as HTMLElement | null)?.innerText?.trim() ||
        (document.querySelector('main h1') as HTMLElement | null)?.innerText?.trim() ||
        (document.querySelector('h1') as HTMLElement | null)?.innerText?.trim() ||
        ''
      const name = h1 || titleName
      const headline =
        (document.querySelector('.text-body-medium.break-words') as HTMLElement | null)?.innerText?.trim() ||
        (document.querySelector('.text-body-medium') as HTMLElement | null)?.innerText?.trim() ||
        ''
      const slug = path.match(/\/in\/([^/]+)/)?.[1]
      const linkedinUrl = slug ? `https://www.linkedin.com/in/${slug}` : location.href
      if (!name) return null
      return {
        kind: 'linkedin-profile',
        person: { name, headline, linkedinUrl },
        link: linkedinUrl,
      }
    }

    // Messaging thread → log a LinkedIn touch with the open conversation partner.
    if (path.includes('/messaging')) {
      const profileLink = document.querySelector(
        'a[href*="/in/"][class*="msg-thread"], .msg-thread a[href*="/in/"], a[data-control-name="topcard"][href*="/in/"]',
      ) as HTMLAnchorElement | null
      const nameEl =
        document.querySelector('.msg-entity-lockup__entity-title') ||
        document.querySelector('.msg-thread__link-to-profile') ||
        document.querySelector('[class*="msg-title-bar"] h2') ||
        document.querySelector('#thread-detail h2')
      const name = nameEl?.textContent?.trim() || profileLink?.textContent?.trim() || ''
      if (!name) return null
      const slug = profileLink?.href.match(/\/in\/([^/?#]+)/)?.[1]
      return {
        kind: 'linkedin-message',
        person: {
          name,
          linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : undefined,
        },
        link: location.href,
      }
    }
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// SSO — reuse the web-app session (unchanged)
// ---------------------------------------------------------------------------
async function readWebSession(): Promise<
  { access_token: string; refresh_token: string } | null
> {
  const origins = RETRN_APP_URLS.map((u) => new URL(u).origin)
  const tabs = await chrome.tabs.query({})
  const tab = tabs.find((t) => t.url && origins.some((o) => t.url!.startsWith(o)))
  if (!tab?.id) return null
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
            return localStorage.getItem(k)
          }
        }
        return null
      },
    })
    const raw = res?.result as string | null
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const s = parsed.currentSession ?? parsed
    if (s?.access_token && s?.refresh_token) {
      return { access_token: s.access_token, refresh_token: s.refresh_token }
    }
    return null
  } catch {
    return null
  }
}

async function connectWithRetrn() {
  renderLoading()
  const sess = await readWebSession()
  if (!sess) {
    await chrome.tabs.create({ url: RETRN_APP_URLS[0] })
    return renderConnectPrompt()
  }
  const { error } = await supabase.auth.setSession(sess)
  if (error) return renderLogin(`Couldn't connect: ${error.message}`)
  void main()
}

async function readContext(): Promise<Context | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return null
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContext,
    })
    return (res?.result as Context | null) ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  return (p[0]?.[0] ?? '?').toUpperCase() + (p[1]?.[0] ?? '').toUpperCase()
}
function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function contactName(c: ContactLite): string {
  return `${c.first_name} ${c.last_name}`.trim()
}
function brandBar(showSignOut = false): string {
  return `
    <div class="brand">
      <span class="logo">R</span><span class="name">Retrn</span>
      <span class="spacer"></span>
      ${showSignOut ? `<button class="link" id="signout">Sign out</button>` : ''}
    </div>`
}
function personCard(p: Person): string {
  const sub = p.email || p.headline || (p.linkedinUrl ? 'LinkedIn profile' : '')
  return `
    <div class="contact">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div class="who">
        <div class="n">${esc(p.name)}</div>
        ${sub ? `<div class="e">${esc(sub)}</div>` : ''}
      </div>
    </div>`
}
function wireSignOut() {
  document.getElementById('signout')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    renderLogin()
  })
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function renderLoading() {
  app.innerHTML = `${brandBar()}<div class="center"><div class="spin"></div>Loading…</div>`
}

function renderLogin(errMsg?: string) {
  app.innerHTML = `
    ${brandBar()}
    <h1>Connect to Retrn</h1>
    <p class="sub">Use your existing session — no second login.</p>
    ${errMsg ? `<div class="notice err" style="margin-bottom:10px">${esc(errMsg)}</div>` : ''}
    <button class="primary" id="li-connect">Connect with Retrn</button>
    <div class="or"><span>or sign in with password</span></div>
    <div class="field"><label>Email</label><input id="li-email" type="email" placeholder="you@school.edu" /></div>
    <div class="field"><label>Password</label><input id="li-pass" type="password" placeholder="••••••••" /></div>
    <button class="ghost" id="li-submit">Sign in</button>
  `
  document.getElementById('li-connect')?.addEventListener('click', () => void connectWithRetrn())
  const submit = document.getElementById('li-submit') as HTMLButtonElement
  const emailEl = document.getElementById('li-email') as HTMLInputElement
  const passEl = document.getElementById('li-pass') as HTMLInputElement
  async function doLogin() {
    submit.disabled = true
    submit.textContent = 'Signing in…'
    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passEl.value,
    })
    if (error) return renderLogin(error.message)
    void main()
  }
  submit.addEventListener('click', () => void doLogin())
  passEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void doLogin()
  })
}

function renderConnectPrompt() {
  app.innerHTML = `
    ${brandBar()}
    <h1>Sign in on the Retrn tab</h1>
    <p class="sub">We opened Retrn in a new tab. Sign in there, then come back and click Connect.</p>
    <button class="primary" id="cp-retry">Connect</button>
    <button class="ghost" id="cp-back">Use password instead</button>
  `
  document.getElementById('cp-retry')?.addEventListener('click', () => void connectWithRetrn())
  document.getElementById('cp-back')?.addEventListener('click', () => renderLogin())
}

function renderNoContext() {
  app.innerHTML = `
    ${brandBar(true)}
    <div class="notice info">
      Open an email in Gmail/Outlook, or a LinkedIn profile or DM, then click the
      Retrn icon to log it.
    </div>
    <p class="muted" style="margin-top:12px">Didn't detect this page? If it's an
      email or profile, reload the tab and try again.</p>
    <button class="ghost" id="dbg">Copy debug info</button>
  `
  wireSignOut()
  document.getElementById('dbg')?.addEventListener('click', () => void copyDebug())
}

/** Copies a snapshot of the active page so extraction issues can be diagnosed. */
async function copyDebug() {
  const btn = document.getElementById('dbg') as HTMLButtonElement
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let diag: unknown = { note: 'no tab' }
  if (tab?.id) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const t = (s: string) => {
            try {
              return (
                (document.querySelector(s) as HTMLElement | null)?.innerText
                  ?.trim()
                  .slice(0, 80) ?? null
              )
            } catch {
              return null
            }
          }
          return {
            url: location.href,
            title: document.title,
            host: location.hostname,
            path: location.pathname,
            h1: t('h1'),
            headingXL: t('.text-heading-xlarge'),
            bodyMedium: t('.text-body-medium'),
            gmailSenders: document.querySelectorAll('span.gD[email]').length,
            gmailRecipients: document.querySelectorAll('span.g2[email]').length,
            googleAccount:
              document.querySelector('[aria-label*="Google Account"]')?.getAttribute('aria-label') ?? null,
            gmailDate:
              document.querySelector('span.g3[title]')?.getAttribute('title') ?? null,
            hasMailto: !!document.querySelector('a[href^="mailto:"]'),
            ariaFrom: !!document.querySelector('[aria-label^="From "]'),
          }
        },
      })
      diag = res?.result ?? { note: 'script returned nothing' }
    } catch (e) {
      diag = { note: 'executeScript failed', error: String(e), url: tab.url }
    }
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(diag, null, 2))
    btn.textContent = 'Copied — paste it to Retrn support'
  } catch {
    btn.textContent = JSON.stringify(diag)
  }
}

/** Email thread with multiple people → pick who this is with. */
function renderParticipantPicker(people: Person[], subject: string, opts: Opts) {
  app.innerHTML = `
    ${brandBar(true)}
    <h1>Who is this with?</h1>
    <p class="sub">${esc(subject || 'This thread')}</p>
    <div class="list">
      ${people
        .map(
          (p, i) => `
        <button class="pick" data-i="${i}">
          <span class="avatar sm">${esc(initials(p.name))}</span>
          <span class="who"><span class="n">${esc(p.name)}</span><span class="e">${esc(p.email || '')}</span></span>
        </button>`,
        )
        .join('')}
    </div>
  `
  wireSignOut()
  document.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) =>
    b.addEventListener('click', () => void resolve(people[Number(b.dataset.i)], opts)),
  )
}

interface Opts {
  action: 'log' | 'linkedin-profile'
  defaultType?: string
  summary?: string
  link: string
  /** Default date (yyyy-mm-dd) for a logged interaction. */
  date?: string
}

/** Find matches for a person, then render the action screen. */
async function resolve(person: Person, opts: Opts) {
  renderLoading()
  let match: ContactLite | null = null
  try {
    if (person.email) match = await findContactByEmail(person.email)
    if (!match && person.linkedinUrl) match = await findContactByLinkedin(person.linkedinUrl)
  } catch {
    /* ignore, treat as no match */
  }
  let candidates: ContactLite[] = []
  if (!match) {
    try {
      candidates = await findContactsByName(person.name)
    } catch {
      /* ignore */
    }
  }
  renderAction(person, opts, match, candidates)
}

function renderAction(
  person: Person,
  opts: Opts,
  match: ContactLite | null,
  candidates: ContactLite[],
) {
  // Build the "save to" options: confident match, name candidates, or new.
  const byId = new Map<string, ContactLite>()
  const options: string[] = []
  if (match) {
    byId.set(match.id, match)
    options.push(`<option value="${match.id}" selected>${esc(contactName(match))} — matched</option>`)
  }
  for (const c of candidates) {
    if (byId.has(c.id)) continue
    byId.set(c.id, c)
    options.push(
      `<option value="${c.id}">${esc(contactName(c))}${c.email ? ' · ' + esc(c.email) : ''}</option>`,
    )
  }
  options.push(`<option value="new"${match ? '' : ' selected'}>➕ New contact: ${esc(person.name)}</option>`)

  const isLinkedInProfile = opts.action === 'linkedin-profile'

  const form = isLinkedInProfile
    ? `
      <div class="field"><label>Title / headline</label><input id="f-title" value="${esc(person.headline || '')}" placeholder="Software Engineer"/></div>
      <div class="field"><label>Company</label><input id="f-company" value="${esc(person.company || '')}" placeholder="Company"/></div>
      <label class="check"><input type="checkbox" id="f-touch"/> Also log a LinkedIn touch</label>
    `
    : `
      <div class="row field">
        <div><label>Type</label><select id="f-type">
          ${INTERACTION_TYPES.map((t) => `<option value="${t}"${t === opts.defaultType ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
        </select></div>
        <div><label>Date</label><input id="f-date" type="date" value="${opts.date || today()}"/></div>
      </div>
      <div class="field"><label>Summary</label><textarea id="f-summary" placeholder="What was this about?">${esc(opts.summary || '')}</textarea></div>
      <label class="check"><input type="checkbox" id="f-link" checked/> Attach ${person.linkedinUrl && !person.email ? 'LinkedIn' : 'email'} link</label>
    `

  app.innerHTML = `
    ${brandBar(true)}
    ${personCard(person)}
    <div class="field"><label>Save to</label><select id="f-target">${options.join('')}</select></div>
    ${form}
    <button class="primary" id="f-go">${isLinkedInProfile ? 'Save to Retrn' : 'Log interaction'}</button>
    <div id="f-err"></div>
  `
  wireSignOut()

  const go = document.getElementById('f-go') as HTMLButtonElement
  go.addEventListener('click', async () => {
    const targetId = (document.getElementById('f-target') as HTMLSelectElement).value
    const target = targetId === 'new' ? null : byId.get(targetId) ?? null
    go.disabled = true
    go.textContent = 'Saving…'
    try {
      if (isLinkedInProfile) {
        const jobTitle = (document.getElementById('f-title') as HTMLInputElement).value.trim()
        const company = (document.getElementById('f-company') as HTMLInputElement).value.trim()
        const alsoLog = (document.getElementById('f-touch') as HTMLInputElement).checked
        const touch = alsoLog
          ? { type: 'linkedin', date: today(), summary: 'Connected on LinkedIn', link: opts.link }
          : undefined
        if (target) {
          await updateContact(target, {
            linkedin_url: person.linkedinUrl,
            company,
            job_title: jobTitle,
          })
          if (touch) await logToExisting(target, touch)
        } else {
          await createContact(
            { name: person.name, linkedinUrl: person.linkedinUrl, company, jobTitle },
            touch,
          )
        }
        renderSuccess(target ? contactName(target) : person.name, 'Saved')
      } else {
        const type = (document.getElementById('f-type') as HTMLSelectElement).value
        const date = (document.getElementById('f-date') as HTMLInputElement).value
        const summary = (document.getElementById('f-summary') as HTMLTextAreaElement).value.trim()
        const attach = (document.getElementById('f-link') as HTMLInputElement).checked
        const input = { type, date, summary, link: attach ? opts.link : undefined }
        if (target) {
          await logToExisting(target, input, {
            email: person.email,
            linkedin_url: person.linkedinUrl,
          })
          renderSuccess(contactName(target), 'Logged')
        } else {
          await createContact(
            {
              name: person.name,
              email: person.email,
              linkedinUrl: person.linkedinUrl,
            },
            input,
          )
          renderSuccess(person.name, 'Logged')
        }
      }
    } catch (err) {
      go.disabled = false
      go.textContent = isLinkedInProfile ? 'Save to Retrn' : 'Log interaction'
      ;(document.getElementById('f-err') as HTMLDivElement).innerHTML =
        `<div class="notice err" style="margin-top:10px">${esc(err instanceof Error ? err.message : 'Could not save.')}</div>`
    }
  })
}

function renderSuccess(name: string, verb: string) {
  app.innerHTML = `
    ${brandBar(true)}
    <div class="notice ok">✓ ${esc(verb)} to ${esc(name)}'s Retrn profile.</div>
    <button class="ghost" id="again">Done</button>
  `
  wireSignOut()
  document.getElementById('again')?.addEventListener('click', () => void main())
}

// ---------------------------------------------------------------------------
async function main() {
  renderLoading()
  const { data } = await supabase.auth.getSession()
  if (!data.session) return renderLogin()

  const ctx = await readContext()
  if (!ctx) return renderNoContext()

  if (ctx.kind === 'email') {
    // "Me" = the Retrn account email + whatever mail account we detected on the
    // page (handles logging from a school address while your Retrn login is a
    // personal one).
    const retrn = (await getMyEmail())?.toLowerCase()
    const mine = new Set(
      [retrn, ...(ctx.me ?? []).map((e) => e.toLowerCase())].filter(Boolean),
    )
    const others = ctx.participants.filter(
      (p) => !p.email || !mine.has(p.email.toLowerCase()),
    )
    const people = others.length > 0 ? others : ctx.participants
    if (people.length === 0) return renderNoContext()

    const opts: Opts = {
      action: 'log',
      defaultType: 'email',
      summary: ctx.subject ? `Re: ${ctx.subject}` : '',
      link: ctx.link,
      date: ctx.date,
    }
    if (people.length === 1) return void resolve(people[0], opts)
    return renderParticipantPicker(people, ctx.subject, opts)
  }

  if (ctx.kind === 'linkedin-profile') {
    return void resolve(ctx.person, { action: 'linkedin-profile', link: ctx.link })
  }

  // linkedin-message
  return void resolve(ctx.person, {
    action: 'log',
    defaultType: 'linkedin',
    summary: 'LinkedIn message',
    link: ctx.link,
  })
}

void main()
