import { useEffect, useState } from 'preact/hooks'
import { retireLegacySession } from '../auth'
import { SESSION_KEY, supabase } from '../supabase'
import { ErrorNotice, Frame, SkeletonRows } from './common'
import { HomeScreen } from './HomeScreen'
import type { ContextSnapshot, Host } from './host'
import { LinkedInScreen } from './LinkedInScreen'
import { LogScreen } from './LogScreen'
import { SignIn } from './SignIn'

type Auth =
  | { status: 'loading' }
  | { status: 'signed-out'; retired: boolean }
  | { status: 'signed-in'; email: string }

/** The extension's UI: sign in, then whatever the page it's attached to calls for. */
export function App({ host }: { host: Host }) {
  const [auth, setAuth] = useState<Auth>({ status: 'loading' })
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)
  const [contextError, setContextError] = useState(false)

  useEffect(() => {
    let retired = false
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user.email
      setAuth(email ? { status: 'signed-in', email } : { status: 'signed-out', retired })
    }

    void retireLegacySession().then((wasRetired) => {
      retired = wasRetired
      return check()
    })

    // This UI's own sign-ins and sign-outs, and failed token refreshes.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void check()
    })
    // Another part of the extension signing in or out (the popup, while a
    // panel is open in Gmail).
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && SESSION_KEY in changes) void check()
    }
    chrome.storage.onChanged.addListener(onStorage)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && host.mode === 'panel') host.close()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      sub.subscription.unsubscribe()
      chrome.storage.onChanged.removeListener(onStorage)
      document.removeEventListener('keydown', onKey)
    }
  }, [host])

  useEffect(() => {
    if (auth.status !== 'signed-in') return
    let cancelled = false
    setContextError(false)
    host
      .getContext()
      .then((s) => !cancelled && setSnapshot(s))
      .catch(() => !cancelled && setContextError(true))
    const unsubscribe = host.onContextChange?.((s) => setSnapshot(s))
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [auth.status, host])

  if (auth.status === 'loading') {
    return (
      <Frame host={host}>
        <SkeletonRows count={2} />
      </Frame>
    )
  }
  if (auth.status === 'signed-out') return <SignIn host={host} retired={auth.retired} />

  if (contextError) {
    return (
      <Frame host={host} account={auth.email}>
        <ErrorNotice>Couldn’t read this page. Reload the tab and try again.</ErrorNotice>
      </Frame>
    )
  }
  if (!snapshot) {
    return (
      <Frame host={host} account={auth.email}>
        <SkeletonRows count={3} />
      </Frame>
    )
  }

  const { context } = snapshot
  if (context?.kind === 'email') {
    // Keyed by thread, so opening another email starts a fresh form.
    return <LogScreen key={context.threadKey} host={host} account={auth.email} context={context} />
  }
  if (context?.kind === 'linkedin-message') {
    return <LogScreen key={context.link} host={host} account={auth.email} context={context} />
  }
  if (context?.kind === 'linkedin-profile') {
    return <LinkedInScreen key={context.link} host={host} account={auth.email} context={context} />
  }
  return <HomeScreen host={host} account={auth.email} pageHost={snapshot.pageHost} />
}
