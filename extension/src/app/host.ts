import type { PageContext } from '../types'

export interface ContextSnapshot {
  context: PageContext | null
  /** Hostname of the page this UI is attached to, for page-specific hints. */
  pageHost: string | null
}

/**
 * Where the app is running. The same screens render in the toolbar popup and
 * in the panel inside Gmail/Outlook; only how they reach the page differs.
 */
export interface Host {
  mode: 'popup' | 'panel'
  getContext(): Promise<ContextSnapshot>
  /** Called when the open email changes underneath a panel that's already open. */
  onContextChange?(listener: (snapshot: ContextSnapshot) => void): () => void
  /** A JSON snapshot of what the page looks like, for "Copy page details". */
  describePage(): Promise<unknown>
  close(): void
  onLogged?(): void
}

export function openUrl(url: string, host: Host) {
  void chrome.tabs.create({ url })
  if (host.mode === 'popup') window.close()
}
