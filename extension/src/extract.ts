import type { PageContext, Person } from './types'

/**
 * Reads what's open on the page: an email thread in Gmail or Outlook, or a
 * LinkedIn profile or conversation.
 *
 * It runs in two ways — imported by the mail content script, and handed to
 * `chrome.scripting.executeScript` by the popup for tabs where no content
 * script is running (LinkedIn, or a mail tab opened before the extension was
 * installed). `executeScript` serialises the function's source and runs it
 * with no module scope, so **everything it uses must be declared inside it**:
 * no imports, no helpers at module level.
 *
 * Each site's markup changes without notice. Every strategy below has
 * fallbacks, and "Copy debug info" in the extension reports which ones
 * matched so a broken selector can be found quickly.
 */
export function extractPageContext(): PageContext | null {
  const EMAIL_RE = /[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/i
  const host = location.hostname

  const visible = (el: Element | null): el is HTMLElement =>
    el instanceof HTMLElement && el.getClientRects().length > 0

  const text = (el: Element | null | undefined): string =>
    ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim()

  /** A local-date yyyy-mm-dd from whatever date string the page shows. */
  const isoDate = (raw: string | null | undefined): string | undefined => {
    if (!raw) return undefined
    let d = new Date(raw)
    // "Mon, Sep 14, 2026, 3:12 PM" → drop the weekday, which some locales
    // format in a way Date can't read.
    if (isNaN(d.getTime())) d = new Date(raw.replace(/^[A-Za-z]+,\s*/, '').replace(/ at /, ' '))
    if (isNaN(d.getTime())) return undefined
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  /**
   * The newest message's own words. Quoted replies are dropped twice over: as
   * the elements mail clients wrap them in, and as the "On … wrote:" /
   * "From: … Sent:" text they start with, for clients that don't wrap them.
   */
  const messageText = (body: HTMLElement): string | undefined => {
    const clone = body.cloneNode(true) as HTMLElement
    clone
      .querySelectorAll(
        '.gmail_quote, .gmail_extra, blockquote, .yj6qo, .adL, [id^="divRplyFwdMsg"], #appendonsend ~ *, .elided-text',
      )
      .forEach((el) => el.remove())
    // A detached copy has no layout, so innerText can't see line breaks; put
    // them back by hand or "meetup.<br>Marcus" reads as "meetup.Marcus".
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
    clone.querySelectorAll('div, p, li, tr').forEach((el) => el.append('\n'))
    const raw = (clone.textContent || '')
      .replace(/\s*On\s[^\n]{5,160}?\swrote:[\s\S]*$/, '')
      .replace(/\s*-{2,}\s*Original Message[\s\S]*$/i, '')
      .replace(/\s*From:\s[^\n]+?\sSent:\s[\s\S]*$/, '')
    return cleanSnippet(raw)
  }

  const cleanSnippet = (raw: string): string | undefined => {
    const lines = raw.split(/\r?\n/)
    const kept: string[] = []
    for (const line of lines) {
      const l = line.trim()
      if (/^On .+wrote:$/i.test(l) || /^-{2,}\s*Original Message/i.test(l)) break
      if (/^From:\s/.test(l) && kept.length > 0) break
      if (l === '--' || l === '-- ') break
      if (l.startsWith('>')) continue
      kept.push(l)
    }
    const out = kept.join(' ').replace(/\s+/g, ' ').trim()
    return out ? out.slice(0, 600) : undefined
  }

  const addPerson = (list: Person[], seen: Set<string>, email: string, name?: string) => {
    const e = email.trim().replace(/^mailto:/i, '').split('?')[0]
    if (!EMAIL_RE.test(e)) return
    const key = e.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const cleanName = (name ?? '')
      .replace(e, '')
      .replace(/^(from|to|cc|bcc)\s*:?\s*/i, '')
      .replace(/[<>()"]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    list.push({ name: cleanName && !EMAIL_RE.test(cleanName) ? cleanName : e, email: e })
  }

  // ------------------------------------------------------------------ Gmail
  if (host === 'mail.google.com') {
    // Gmail keeps previously opened threads in the DOM, hidden; only the one
    // on screen counts.
    const subjectEl = Array.from(document.querySelectorAll('h2.hP')).find(visible)
    if (!subjectEl) return null
    const scope =
      subjectEl.closest('[role="main"]') ?? subjectEl.closest('.nH') ?? document.body

    const seen = new Set<string>()
    const participants: Person[] = []
    const senders = Array.from(scope.querySelectorAll('span.gD[email]'))
    // Senders (.gD) and recipients (.g2) both carry the address, so an email
    // you sent still surfaces the person you sent it to.
    for (const el of Array.from(scope.querySelectorAll('span.gD[email], span.g2[email]'))) {
      addPerson(participants, seen, el.getAttribute('email') ?? '', el.getAttribute('name') ?? text(el))
    }
    if (participants.length === 0) return null

    const me = new Set<string>()
    const titleEmail = document.title.match(EMAIL_RE)?.[0]
    if (titleEmail) me.add(titleEmail.toLowerCase())
    const accountEmail = document
      .querySelector('[aria-label*="Google Account"]')
      ?.getAttribute('aria-label')
      ?.match(EMAIL_RE)?.[0]
    if (accountEmail) me.add(accountEmail.toLowerCase())

    const dates = Array.from(scope.querySelectorAll('span.g3[title]'))
    const date = isoDate(dates[dates.length - 1]?.getAttribute('title'))

    const bodies = Array.from(scope.querySelectorAll('div.a3s')).filter(visible)
    const snippet = bodies.length ? messageText(bodies[bodies.length - 1]) : undefined

    // The legacy id is the one Gmail URLs accept in any folder (#all/<id>);
    // the hash segment is only right for the folder it was opened from.
    const legacyId = subjectEl.getAttribute('data-legacy-thread-id')
    const permId = subjectEl.getAttribute('data-thread-perm-id')
    const hashId = location.hash.split('/').pop()?.split('?')[0] ?? ''
    // Whichever id ends up inside `link`, so a saved interaction can be matched
    // back to this thread by substring.
    const threadKey = legacyId || hashId || permId || location.href
    const accountPath = location.pathname.match(/^\/mail\/u\/\d+\//)?.[0] ?? '/mail/u/0/'
    const link = legacyId
      ? `${location.origin}${accountPath}#all/${legacyId}`
      : location.href

    return {
      kind: 'email',
      provider: 'gmail',
      subject: text(subjectEl),
      link,
      threadKey,
      date,
      me: Array.from(me),
      participants,
      lastFrom: senders[senders.length - 1]?.getAttribute('email') ?? undefined,
      snippet,
    }
  }

  // ---------------------------------------------------------------- Outlook
  if (/(^|\.)outlook\.(office|office365|live)\.com$/.test(host) || host === 'outlook.cloud.microsoft') {
    const scope =
      [
        '#ReadingPaneContainerId',
        '[data-app-section="ConversationContainer"]',
        '[aria-label="Reading Pane"]',
        '[aria-label="Reading pane"]',
      ]
        .map((s) => document.querySelector(s))
        .find(visible) ?? null
    if (!scope) return null

    // Message bodies can mention any address; only the header chrome — the
    // sender and recipient personas — says who the email is between.
    const inBody = (el: Element) =>
      Boolean(el.closest('[aria-label="Message body"], [role="document"], .allowTextSelection'))

    const seen = new Set<string>()
    const participants: Person[] = []
    for (const el of Array.from(scope.querySelectorAll('[title*="@"], [aria-label*="@"]'))) {
      if (inBody(el)) continue
      for (const attr of ['title', 'aria-label']) {
        const v = el.getAttribute(attr) ?? ''
        const m = v.match(EMAIL_RE)
        if (m) addPerson(participants, seen, m[0], v.includes('<') ? v.split('<')[0] : text(el))
      }
    }
    // Some layouts print "Name <address>" as plain header text.
    for (const el of Array.from(scope.querySelectorAll('span, div'))) {
      if (el.children.length > 0 || inBody(el)) continue
      const t = el.textContent ?? ''
      if (t.length > 160 || !t.includes('@')) continue
      const m = t.match(/^(.*?)<([^>]+@[^>]+)>/)
      if (m) addPerson(participants, seen, m[2], m[1])
    }
    for (const a of Array.from(scope.querySelectorAll('a[href^="mailto:"]'))) {
      if (!inBody(a)) addPerson(participants, seen, a.getAttribute('href') ?? '', text(a))
    }
    if (participants.length === 0) return null

    const subject =
      text(
        [
          '[data-testid="ConversationSubject"]',
          '#ConversationReadingPaneContainer [role="heading"]',
          '[role="heading"][aria-level="2"]',
          '[role="heading"]',
        ]
          .map((s) => scope.querySelector(s))
          .find((el) => el && text(el)),
      ) || ''

    const me = new Set<string>()
    for (const sel of ['#mectrl_currentAccount_secondary', '#O365_MainLink_Me', '[data-testid="AccountManager"]']) {
      const el = document.querySelector(sel)
      const m = (text(el) + ' ' + (el?.getAttribute('aria-label') ?? '')).match(EMAIL_RE)
      if (m) me.add(m[0].toLowerCase())
    }

    const timeEl =
      scope.querySelector('[data-testid="SentReceivedSavedTime"]') ?? scope.querySelector('time')
    const date = isoDate(timeEl?.getAttribute('datetime') || timeEl?.getAttribute('title') || text(timeEl))

    const bodies = Array.from(scope.querySelectorAll('[aria-label="Message body"]')).filter(visible)
    const snippet = bodies.length ? messageText(bodies[bodies.length - 1]) : undefined

    const messageId = location.pathname.match(/\/id\/([^/?#]+)/)?.[1]
    return {
      kind: 'email',
      provider: 'outlook',
      subject,
      link: location.href,
      // Kept URL-encoded, exactly as it appears in `link`.
      threadKey: messageId ?? location.href,
      date,
      me: Array.from(me),
      participants,
      lastFrom: participants[0]?.email,
      snippet,
    }
  }

  // --------------------------------------------------------------- LinkedIn
  if (host === 'www.linkedin.com' || host === 'linkedin.com') {
    const path = location.pathname
    // "(3) Jordan Lee | LinkedIn" or "Jordan Lee - Title | LinkedIn"
    const titleName = document.title
      .replace(/\s*\|\s*LinkedIn.*$/i, '')
      .replace(/^\(\d+\)\s*/, '')
      .split(/ - | \| /)[0]
      .trim()

    if (path.startsWith('/in/')) {
      const name =
        text(document.querySelector('.text-heading-xlarge')) ||
        text(document.querySelector('main h1')) ||
        titleName
      const headline =
        text(document.querySelector('.text-body-medium.break-words')) ||
        text(document.querySelector('main .text-body-medium'))
      const slug = path.match(/^\/in\/([^/]+)/)?.[1]
      if (!name) return null
      const linkedinUrl = slug ? `https://www.linkedin.com/in/${slug}` : location.href
      return { kind: 'linkedin-profile', person: { name, headline, linkedinUrl }, link: linkedinUrl }
    }

    if (path.startsWith('/messaging')) {
      const profileLink = document.querySelector<HTMLAnchorElement>(
        '.msg-thread a[href*="/in/"], a.msg-thread__link-to-profile[href*="/in/"], .msg-title-bar a[href*="/in/"]',
      )
      const name =
        text(document.querySelector('.msg-entity-lockup__entity-title')) ||
        text(document.querySelector('.msg-thread__link-to-profile')) ||
        text(document.querySelector('.msg-title-bar h2')) ||
        text(profileLink)
      if (!name) return null
      const slug = profileLink?.href.match(/\/in\/([^/?#]+)/)?.[1]
      return {
        kind: 'linkedin-message',
        person: { name, linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : undefined },
        link: location.href,
      }
    }
  }

  return null
}

/** What the page looks like to the extractor, for "Copy debug info". */
export function describePage(): Record<string, unknown> {
  const count = (s: string) => {
    try {
      return document.querySelectorAll(s).length
    } catch {
      return -1
    }
  }
  return {
    url: location.href,
    title: document.title,
    gmail: {
      subjects: count('h2.hP'),
      senders: count('span.gD[email]'),
      recipients: count('span.g2[email]'),
      dates: count('span.g3[title]'),
      bodies: count('div.a3s'),
    },
    outlook: {
      readingPane: count('#ReadingPaneContainerId'),
      conversation: count('[data-app-section="ConversationContainer"]'),
      readingPaneLabel: count('[aria-label="Reading Pane"], [aria-label="Reading pane"]'),
      headings: count('[role="heading"]'),
      emailAttrs: count('[title*="@"], [aria-label*="@"]'),
      bodies: count('[aria-label="Message body"]'),
    },
    linkedin: {
      headingXL: count('.text-heading-xlarge'),
      messaging: count('.msg-thread'),
    },
  }
}
