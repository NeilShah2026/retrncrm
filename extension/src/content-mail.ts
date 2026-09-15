import { describePage, extractPageContext } from './extract'
import type { EmailContext, PageContext, PanelMessage, RuntimeMessage, ThreadStatus } from './types'

/**
 * Runs inside Gmail and Outlook. Watches for an open email, puts a "Log to
 * Retrn" button next to its subject, and opens the Retrn panel over the page
 * when that's clicked. It never talks to Retrn itself — the panel (an
 * extension page, with the session) and the background worker do.
 */

declare global {
  interface Window {
    __retrnMail?: boolean
  }
}

if (!window.__retrnMail) {
  window.__retrnMail = true
  start()
}

function start() {
  const EXTENSION_ORIGIN = new URL(chrome.runtime.getURL('')).origin
  const Z = '2147483600'

  let context: PageContext | null = null
  let threadKey: string | null = null
  let status: ThreadStatus | null = null

  let chipHost: HTMLElement | null = null
  let chipButton: HTMLButtonElement | null = null
  let panelHost: HTMLElement | null = null
  let port: MessagePort | null = null

  // ------------------------------------------------------------- watching

  function scan() {
    let next: PageContext | null = null
    try {
      next = extractPageContext()
    } catch {
      next = null
    }
    const key = next?.kind === 'email' ? next.threadKey : null
    context = next

    if (key !== threadKey) {
      threadKey = key
      status = null
      if (key) void refreshStatus()
      // Left the email: the panel was about that email, so it goes too.
      if (!key) closePanel()
      else port?.postMessage({ type: 'retrn:context', context, host: location.hostname } satisfies PanelMessage)
    }
    placeChip()
  }

  let scheduled = false
  const scheduleScan = () => {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      scan()
    }, 350)
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('hashchange', scheduleScan)
  window.addEventListener('popstate', scheduleScan)
  scan()

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, reply) => {
    if (message.type === 'retrn:context-request') {
      reply({ context: safeExtract() })
    } else if (message.type === 'retrn:describe-request') {
      reply({ details: describePage() })
    } else if (message.type === 'retrn:refresh-status') {
      void refreshStatus()
    }
    return false
  })

  function safeExtract(): PageContext | null {
    try {
      return extractPageContext()
    } catch {
      return null
    }
  }

  async function refreshStatus() {
    const key = threadKey
    if (!key || context?.kind !== 'email') return
    const emails = (context as EmailContext).participants.map((p) => p.email ?? '').filter(Boolean)
    try {
      const next = (await chrome.runtime.sendMessage({
        type: 'retrn:status',
        emails,
        threadKey: key,
      } satisfies RuntimeMessage)) as ThreadStatus | undefined
      if (key === threadKey && next) {
        status = next
        paintChip()
      }
    } catch {
      // Extension reloaded underneath this page; the old script is orphaned.
    }
  }

  // ----------------------------------------------------------------- chip

  function pageIsDark(): boolean {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number)
    if (!bg || bg.length < 3 || bg[3] === 0) return false
    return (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255 < 0.5
  }

  /** The element the button sits after: the open email's subject. */
  function findAnchor(): Element | null {
    if (location.hostname === 'mail.google.com') {
      return Array.from(document.querySelectorAll('h2.hP')).find((el) => el.getClientRects().length > 0) ?? null
    }
    const pane = ['#ReadingPaneContainerId', '[data-app-section="ConversationContainer"]', '[aria-label="Reading Pane"]']
      .map((s) => document.querySelector(s))
      .find((el) => el && el.getClientRects().length > 0)
    return (
      pane?.querySelector('[data-testid="ConversationSubject"]') ??
      pane?.querySelector('[role="heading"]') ??
      null
    )
  }

  function placeChip() {
    if (context?.kind !== 'email') {
      chipHost?.remove()
      return
    }
    if (!chipHost) buildChip()
    const anchor = findAnchor()
    if (anchor?.parentElement) {
      if (chipHost!.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', chipHost!)
      chipHost!.dataset.floating = 'false'
    } else if (!chipHost!.isConnected || chipHost!.dataset.floating !== 'true') {
      // No subject to sit beside: float in the corner instead of disappearing.
      document.body.appendChild(chipHost!)
      chipHost!.dataset.floating = 'true'
    }
    paintChip()
  }

  function buildChip() {
    chipHost = document.createElement('retrn-log-button')
    const shadow = chipHost.attachShadow({ mode: 'closed' })
    shadow.innerHTML = `
      <style>
        :host { all: initial; display: inline-flex; vertical-align: middle; margin: 0 0 0 10px; }
        :host([data-floating="true"]) { position: fixed; right: 24px; bottom: 24px; margin: 0; z-index: ${Z}; }
        button {
          display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px 0 4px;
          border-radius: 8px; border: 1px solid rgba(24, 24, 27, 0.14); background: #fff; color: #18181b;
          font: 500 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          letter-spacing: -0.005em; cursor: pointer; white-space: nowrap;
          transition: background-color 120ms cubic-bezier(0.2, 0, 0, 1), border-color 120ms cubic-bezier(0.2, 0, 0, 1);
        }
        :host([data-floating="true"]) button { height: 34px; box-shadow: 0 6px 20px -6px rgba(0,0,0,.25); }
        button:hover { background: #f4f4f5; border-color: rgba(24, 24, 27, 0.24); }
        button:focus-visible { outline: 2px solid #1d63d8; outline-offset: 2px; }
        button[aria-pressed="true"] { background: #f4f4f5; }
        .mark {
          display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px;
          background: #18181b; color: #fafafa; font-size: 11px; font-weight: 600;
        }
        .done { color: #1f7a4f; display: none; }
        :host([data-logged="true"]) .done { display: inline; }
        :host([data-theme="dark"]) button { background: #1f1f23; color: #f4f4f5; border-color: rgba(255,255,255,.16); }
        :host([data-theme="dark"]) button:hover,
        :host([data-theme="dark"]) button[aria-pressed="true"] { background: #2a2a2f; }
        :host([data-theme="dark"]) .mark { background: #f4f4f5; color: #18181b; }
        :host([data-theme="dark"]) .done { color: #5fd3a0; }
      </style>
      <button type="button" aria-pressed="false">
        <span class="mark" aria-hidden="true">R</span>
        <span class="label">Log to Retrn</span>
        <svg class="done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      </button>`
    chipButton = shadow.querySelector('button')
    chipButton!.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (panelHost) closePanel()
      else openPanel()
    })
  }

  function paintChip() {
    if (!chipHost || !chipButton) return
    const label = chipButton.querySelector('.label')!
    const logged = Boolean(status?.logged)
    chipHost.dataset.logged = String(logged)
    chipHost.dataset.theme = pageIsDark() ? 'dark' : 'light'
    label.textContent = logged ? 'Logged in Retrn' : 'Log to Retrn'
    chipButton.title = logged
      ? 'Already on their timeline in Retrn'
      : status?.known
        ? `${status.known === 1 ? 'Someone' : `${status.known} people`} on this email ${status.known === 1 ? 'is' : 'are'} in Retrn`
        : 'Log this email to Retrn'
    chipButton.setAttribute('aria-pressed', String(Boolean(panelHost)))
  }

  // ---------------------------------------------------------------- panel

  function openPanel() {
    if (panelHost) return
    const nonce = crypto.randomUUID()
    panelHost = document.createElement('retrn-panel')
    const shadow = panelHost.attachShadow({ mode: 'closed' })
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          position: fixed; top: 72px; right: 16px; z-index: ${Z};
          width: 380px; height: min(640px, calc(100vh - 96px));
          border-radius: 10px; overflow: hidden; background: #fff;
          box-shadow: 0 0 0 1px rgba(24, 24, 27, 0.1), 0 24px 48px -12px rgba(0, 0, 0, 0.28);
          opacity: 0; transform: translateY(-6px);
          transition: opacity 160ms cubic-bezier(0.2, 0, 0, 1), transform 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .wrap.open { opacity: 1; transform: none; }
        @media (prefers-color-scheme: dark) { .wrap { background: #161618; box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 24px 48px -12px rgba(0,0,0,.6); } }
        @media (prefers-reduced-motion: reduce) { .wrap { transition: none; } }
        iframe { display: block; width: 100%; height: 100%; border: 0; color-scheme: normal; }
      </style>
      <div class="wrap" role="dialog" aria-label="Retrn"><iframe title="Retrn" allow="clipboard-write"></iframe></div>`
    const wrap = shadow.querySelector('.wrap') as HTMLDivElement
    const frame = shadow.querySelector('iframe') as HTMLIFrameElement

    frame.addEventListener('load', () => {
      const channel = new MessageChannel()
      port = channel.port1
      port.onmessage = (event: MessageEvent<PanelMessage>) => {
        const message = event.data
        if (message.type === 'retrn:context-request') {
          context = safeExtract()
          port?.postMessage({ type: 'retrn:context', context, host: location.hostname } satisfies PanelMessage)
        } else if (message.type === 'retrn:describe-request') {
          port?.postMessage({ type: 'retrn:describe', details: describePage() } satisfies PanelMessage)
        } else if (message.type === 'retrn:close') {
          closePanel()
        } else if (message.type === 'retrn:logged') {
          void refreshStatus()
        }
      }
      frame.contentWindow?.postMessage({ type: 'retrn:port', nonce }, EXTENSION_ORIGIN, [channel.port2])
      requestAnimationFrame(() => wrap.classList.add('open'))
    })
    frame.src = `${chrome.runtime.getURL('panel.html')}#${nonce}`

    document.documentElement.appendChild(panelHost)
    window.addEventListener('keydown', onKey, true)
    paintChip()
  }

  function closePanel() {
    if (!panelHost) return
    port?.close()
    port = null
    panelHost.remove()
    panelHost = null
    window.removeEventListener('keydown', onKey, true)
    paintChip()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && panelHost) {
      e.stopPropagation()
      closePanel()
    }
  }
}
