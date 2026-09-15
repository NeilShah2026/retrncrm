import { render } from 'preact'
import { App } from './app/App'
import type { ContextSnapshot, Host } from './app/host'
import { describePage, extractPageContext } from './extract'
import type { PageContext, RuntimeMessage } from './types'

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

/**
 * The toolbar popup. Asks the tab's content script what's open when there is
 * one (Gmail, Outlook), and otherwise reads the page directly — LinkedIn, or
 * a mail tab that was already open when the extension was installed.
 */
const host: Host = {
  mode: 'popup',

  async getContext(): Promise<ContextSnapshot> {
    const tab = await activeTab()
    if (!tab?.id || !tab.url) return { context: null, pageHost: null }
    let pageHost: string | null = null
    try {
      pageHost = new URL(tab.url).hostname
    } catch {
      return { context: null, pageHost: null }
    }

    try {
      const reply = (await chrome.tabs.sendMessage(tab.id, {
        type: 'retrn:context-request',
      } satisfies RuntimeMessage)) as { context: PageContext | null } | undefined
      if (reply && 'context' in reply) return { context: reply.context, pageHost }
    } catch {
      // No content script in this tab.
    }

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContext,
      })
      return { context: (result?.result as PageContext | null) ?? null, pageHost }
    } catch {
      // A page extensions can't read (chrome://, the Web Store).
      return { context: null, pageHost }
    }
  },

  async describePage() {
    const tab = await activeTab()
    if (!tab?.id) return { note: 'No active tab' }
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: describePage })
      return result?.result ?? { note: 'Nothing returned', url: tab.url }
    } catch (err) {
      return { note: 'Could not read the page', error: String(err), url: tab.url }
    }
  },

  close() {
    window.close()
  },
}

render(<App host={host} />, document.getElementById('app')!)
