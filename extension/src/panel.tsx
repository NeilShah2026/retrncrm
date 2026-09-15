import { render } from 'preact'
import { App } from './app/App'
import type { ContextSnapshot, Host } from './app/host'
import type { PanelMessage } from './types'

/**
 * The panel inside Gmail and Outlook: this page, framed by the content script.
 *
 * Everything it learns about the email arrives over a MessageChannel the
 * content script hands over on load, tagged with the nonce in this frame's
 * URL. The mail page's own scripts can post to this frame too, but they never
 * see the nonce (the frame lives in a closed shadow root), so nothing they send
 * is trusted.
 */
const nonce = location.hash.slice(1)
let port: MessagePort | null = null
const listeners = new Set<(s: ContextSnapshot) => void>()
const pending: Array<(m: PanelMessage) => boolean> = []

const connected = new Promise<MessagePort | null>((resolve) => {
  const timer = setTimeout(() => resolve(null), 4000)
  window.addEventListener('message', function onMessage(event) {
    const data = event.data as { type?: string; nonce?: string } | null
    if (!nonce || data?.type !== 'retrn:port' || data.nonce !== nonce || !event.ports[0]) return
    window.removeEventListener('message', onMessage)
    clearTimeout(timer)
    port = event.ports[0]
    port.onmessage = (e: MessageEvent<PanelMessage>) => {
      const message = e.data
      // A reply someone is waiting for…
      const waiting = pending.findIndex((match) => match(message))
      if (waiting >= 0) {
        pending.splice(waiting, 1)
        return
      }
      // …or the open email changing underneath the panel.
      if (message.type === 'retrn:context') {
        listeners.forEach((l) => l({ context: message.context, pageHost: message.host }))
      }
    }
    resolve(port)
  })
})

function request<T extends PanelMessage['type']>(
  send: PanelMessage,
  reply: T,
): Promise<Extract<PanelMessage, { type: T }> | null> {
  return connected.then(
    (p) =>
      new Promise((resolve) => {
        if (!p) return resolve(null)
        const timer = setTimeout(() => resolve(null), 3000)
        pending.push((m) => {
          if (m.type !== reply) return false
          clearTimeout(timer)
          resolve(m as Extract<PanelMessage, { type: T }>)
          return true
        })
        p.postMessage(send)
      }),
  )
}

const host: Host = {
  mode: 'panel',
  async getContext() {
    const reply = await request({ type: 'retrn:context-request' }, 'retrn:context')
    return { context: reply?.context ?? null, pageHost: reply?.host ?? null }
  },
  onContextChange(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  async describePage() {
    const reply = await request({ type: 'retrn:describe-request' }, 'retrn:describe')
    return reply?.details ?? { note: 'The page did not answer' }
  },
  close() {
    port?.postMessage({ type: 'retrn:close' } satisfies PanelMessage)
  },
  onLogged() {
    port?.postMessage({ type: 'retrn:logged' } satisfies PanelMessage)
  },
}

render(<App host={host} />, document.getElementById('app')!)
