import { findContactsByEmails, loggedEntry } from './db'
import { SESSION_KEY, supabase } from './supabase'
import type { RuntimeMessage, ThreadStatus } from './types'

/**
 * The service worker. Answers "is this email already in Retrn?" for the
 * button in Gmail and Outlook, and keeps those buttons current when the
 * extension signs in or out.
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
