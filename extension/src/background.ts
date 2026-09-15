import { authMessage, clearPendingSignIn, completeMagicLink, getPendingSignIn, readMagicLinkRedirect } from './auth'
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

// A magic link opens a Retrn tab with a one-time code on the end. The popup is
// long closed by then, so the worker redeems it — but only while the extension
// is waiting on a link, so the website's own sign-ins are left alone.
const redeeming = new Set<string>()

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // `url` is only reported for sites in host_permissions, which the Retrn
  // origins are.
  if (!changeInfo.url) return
  const redirect = readMagicLinkRedirect(changeInfo.url)
  if (!redirect) return
  void finishSignIn(tabId, redirect)
})

async function finishSignIn(tabId: number, redirect: { code: string } | { error: string }) {
  if (!(await getPendingSignIn())) return
  let error: string | null = null
  if ('code' in redirect) {
    if (redeeming.has(redirect.code)) return
    redeeming.add(redirect.code)
    try {
      await completeMagicLink(redirect.code)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  } else {
    await clearPendingSignIn()
    error = authMessage(redirect.error)
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
