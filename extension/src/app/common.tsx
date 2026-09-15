import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { APP_ORIGIN } from '../config'
import { signOut } from '../auth'
import { avatarTint, initials } from '../ui/format'
import { Alert, ExternalLink, LogOut, X } from '../ui/icons'
import { openUrl, type Host } from './host'

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const tint = avatarTint(name)
  return (
    <span class={`avatar${large ? ' lg' : ''}${tint === 'neutral' ? '' : ` av-${tint}`}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function Spinner() {
  return <span class="spinner" role="status" aria-label="Loading" />
}

export function ErrorNotice({ children }: { children: ComponentChildren }) {
  return (
    <div class="notice notice-error" role="alert">
      <Alert size={14} />
      <div>{children}</div>
    </div>
  )
}

/** Header, scrolling body, pinned footer — every screen's shape. */
export function Frame({
  host,
  account,
  children,
  footer,
}: {
  host: Host
  account?: string | null
  children: ComponentChildren
  footer?: ComponentChildren
}) {
  return (
    <div class="frame">
      <header class="frame-header">
        <a
          class="logo"
          href={`${APP_ORIGIN}/app`}
          onClick={(e) => {
            e.preventDefault()
            openUrl(`${APP_ORIGIN}/app`, host)
          }}
          title="Open Retrn"
        >
          <span class="logo-mark">R</span>
          <span class="logo-word">Retrn</span>
        </a>
        <span class="spacer" />
        {account && <AccountMenu email={account} host={host} />}
        {host.mode === 'panel' && (
          <button class="btn btn-ghost btn-icon" onClick={() => host.close()} aria-label="Close" title="Close (Esc)">
            <X size={16} />
          </button>
        )}
      </header>
      <main class="frame-body">{children}</main>
      {footer && <footer class="frame-footer">{footer}</footer>}
    </div>
  )
}

function AccountMenu({ email, host }: { email: string; host: Host }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div class="relative" ref={ref}>
      <button
        class="btn btn-ghost btn-icon"
        style={{ width: '32px', height: '32px' }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${email}`}
        title={email}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={email} />
      </button>
      {open && (
        <div class="menu" role="menu">
          <div class="menu-label truncate">{email}</div>
          <button class="menu-item" role="menuitem" onClick={() => openUrl(`${APP_ORIGIN}/app`, host)}>
            <ExternalLink size={14} />
            Open Retrn
          </button>
          <div class="menu-sep" />
          <button
            class="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            <LogOut size={14} />
            Sign out of the extension
          </button>
        </div>
      )}
    </div>
  )
}

/** Placeholder rows shaped like the list that's loading. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div class="panel" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div class="row" key={i}>
          <span class="skeleton" style={{ width: '28px', height: '28px', borderRadius: '999px' }} />
          <div class="row-main">
            <div class="skeleton" style={{ width: '55%', height: '10px' }} />
            <div class="skeleton" style={{ width: '35%', height: '8px', marginTop: '6px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
