import {
  authMessage,
  clearPendingSignIn,
  completeMagicLink,
  completeTokenSignIn,
  getPendingSignIn,
  readMagicLinkRedirect,
  type MagicLinkRedirect,
} from './auth'
import { findContactsByEmails, loggedEntry } from './db'
import { SESSION_KEY, supabase } from './supabase'
import type { RuntimeMessage, ThreadStatus } from './types'

/**
 * The service worker. Finishes magic-link sign-ins, answers "is this email
 * already in Retrn?" for the button in Gmail and Outlook, and keeps those
 * buttons current when the extension signs in or out.
 */

const MAIL_TABS = [
  'https://mail.google.com/*',
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://outlook.live.com/*',
  'https://outlook.cloud.microsoft/*',
]

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, reply) => {
  if (message.type !== 'retrn:status') return false
  void threadStatus(message.emails, message.threadKey).then(reply)
  return true // replying asynchronously
})

async function threadStatus(emails: string[], threadKey: string): Promise<ThreadStatus> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return { signedIn: false, known: 0, logged: false }
  try {
    const contacts = await findContactsByEmails(emails)
    return {
      signedIn: true,
      known: contacts.length,
      logged: contacts.some((c) => Boolean(loggedEntry(c, threadKey))),
    }
  } catch (err) {
    console.warn('Retrn: status check failed', err)
    return { signedIn: true, known: 0, logged: false }
  }
}

// A sign-in link opens a Retrn tab carrying a one-time token. The popup is
// long closed by then, so the worker redeems it — but only while the extension
// is waiting on a link, and only for the PKCE-marked tokens that are the
// extension's own, so the website's sign-ins are left alone.
//
// The race worth knowing about: the tab is the web app's /auth/confirm, which
// spends nothing until someone taps its button. Reading the URL here happens
// as the navigation commits, well before that page has even rendered, so the
// worker is first in practice.
const redeeming = new Set<string>()

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // `url` is only reported for sites in host_permissions, which the Retrn
  // origins are.
  if (!changeInfo.url) return
  const redirect = readMagicLinkRedirect(changeInfo.url)
  if (!redirect) return
  void finishSignIn(tabId, redirect)
})

async function finishSignIn(tabId: number, redirect: MagicLinkRedirect) {
  if (!(await getPendingSignIn())) return
  let error: string | null = null
  if (redirect.kind === 'error') {
    await clearPendingSignIn()
    error = authMessage(redirect.message)
  } else {
    // Navigating the tab below can report the same URL twice; a token or code
    // is only good once, so the second report has to be ignored.
    const once = redirect.kind === 'token' ? redirect.tokenHash : redirect.code
    if (redeeming.has(once)) return
    redeeming.add(once)
    try {
      if (redirect.kind === 'token') await completeTokenSignIn(redirect.tokenHash, redirect.type)
      else await completeMagicLink(redirect.code)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }
  const page = new URL(chrome.runtime.getURL('signed-in.html'))
  if (error) page.searchParams.set('error', error)
  chrome.tabs.update(tabId, { url: page.href }).catch(() => {})
}

// Signing in or out changes what every open mail tab's button should say.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(SESSION_KEY in changes)) return
  void chrome.tabs.query({ url: MAIL_TABS }).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'retrn:refresh-status' } satisfies RuntimeMessage).catch(() => {})
    }
  })
})

// Mail tabs that were already open when the extension was installed or
// updated have no content script until they reload. Add it now, so the
// button is there without asking anyone to refresh Gmail.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.tabs.query({ url: MAIL_TABS }).then((tabs) => {
    for (const tab of tabs) {
      if (!tab.id || tab.discarded) continue
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-mail.js'] }).catch(() => {})
    }
  })
})
