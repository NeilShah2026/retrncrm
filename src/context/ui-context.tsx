import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { VoiceCaptureDialog } from '@/components/contacts/VoiceCaptureDialog'
import { QuickAddSheet } from '@/components/contacts/QuickAddSheet'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CommandPalette } from '@/components/search/CommandPalette'
import { useAuth } from '@/auth/AuthProvider'
import { hasOnboarded } from '@/lib/onboarding'
import { useAssistant } from '@/context/assistant-context'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

interface UIContextValue {
  openNewContact: () => void
  /** The one-sentence capture sheet — the low-friction way to add someone. */
  openVoiceCapture: () => void
  openEditContact: (contact: Contact) => void
  openSearch: () => void
  /**
   * Go to the assistant, optionally with a first message to run on arrival.
   * It's a screen rather than a dialog now, so this navigates.
   */
  openAssistant: (question?: string) => void
  /** Runs the first-run flow again, from Settings. */
  openOnboarding: () => void
}

const UIContext = React.createContext<UIContextValue | null>(null)

/** Returns true if focus is in a field where typing shortcuts should be ignored. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { handOff } = useAssistant()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [voiceOpen, setVoiceOpen] = React.useState(false)
  const isMobile = useIsMobile()

  const openNewContact = React.useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openEditContact = React.useCallback((contact: Contact) => {
    setEditing(contact)
    setFormOpen(true)
  }, [])

  const openVoiceCapture = React.useCallback(() => setVoiceOpen(true), [])
  const openAssistant = React.useCallback(
    (question?: string) => {
      // Queue first, navigate second: the chat picks the message up as it
      // mounts, so nothing is retyped and nothing runs twice.
      if (question?.trim()) handOff(question)
      navigate(ROUTES.assistant)
    },
    [handOff, navigate],
  )
  const openSearch = React.useCallback(() => setSearchOpen(true), [])
  const openOnboarding = React.useCallback(
    () => navigate(ROUTES.onboarding),
    [navigate],
  )

  // Onboarding runs automatically the first time someone reaches the app on
  // this account. Tracked on the account itself (not localStorage) so it
  // doesn't reappear every time they sign in on a new device — and so
  // finishing it on a phone means it is done on the web too.
  //
  // At most once per session, and never on top of itself. `onboarded` is
  // written asynchronously when the flow finishes, so without the latch a
  // save that is slow (or fails) would send someone who just finished
  // straight back to the welcome screen.
  const autoStarted = React.useRef(false)
  React.useEffect(() => {
    if (!user || autoStarted.current) return
    if (hasOnboarded(user)) return
    if (window.location.pathname === ROUTES.onboarding) return
    autoStarted.current = true
    navigate(ROUTES.onboarding, { replace: true })
  }, [user, navigate])

  // Global keyboard shortcuts: Cmd/Ctrl+K → search, "N" → new contact.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return
      }
      const bare =
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        !formOpen &&
        !searchOpen &&
        !voiceOpen
      if (!bare) return
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openNewContact()
        return
      }
      // "V" for voice — the fastest path from "I just met someone" to saved.
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault()
        openVoiceCapture()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    formOpen,
    searchOpen,
    voiceOpen,
    openNewContact,
    openVoiceCapture,
  ])

  const value = React.useMemo(
    () => ({
      openNewContact,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAssistant,
      openOnboarding,
    }),
    [
      openNewContact,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAssistant,
      openOnboarding,
    ],
  )

  return (
    <UIContext.Provider value={value}>
      {children}
      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
      />
      {/* A phone gets the two-field sheet — name, where you met, a small mic.
          A desktop keeps the one-sentence capture with its review step. */}
      {isMobile ? (
        <QuickAddSheet open={voiceOpen} onOpenChange={setVoiceOpen} />
      ) : (
        <VoiceCaptureDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
      )}
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNewContact={openNewContact}
        onVoiceCapture={openVoiceCapture}
        onAssistant={openAssistant}
      />
    </UIContext.Provider>
  )
}

export function useUI(): UIContextValue {
  const ctx = React.useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}
