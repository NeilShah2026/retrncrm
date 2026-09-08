import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { VoiceCaptureDialog } from '@/components/contacts/VoiceCaptureDialog'
import { CommandPalette } from '@/components/search/CommandPalette'
import { WelcomeTour } from '@/components/onboarding/WelcomeTour'
import { useAuth } from '@/auth/AuthProvider'
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
  openWelcomeTour: () => void
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
  const { user, markOnboarded } = useAuth()
  const navigate = useNavigate()
  const { handOff } = useAssistant()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [tourOpen, setTourOpen] = React.useState(false)
  const [voiceOpen, setVoiceOpen] = React.useState(false)

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
  const openWelcomeTour = React.useCallback(() => setTourOpen(true), [])

  // Show the welcome tour automatically the first time someone reaches the
  // app on this account — tracked on the account itself (not localStorage)
  // so it doesn't reappear every time they sign in on a new device.
  React.useEffect(() => {
    if (user && !user.user_metadata?.onboarded) setTourOpen(true)
  }, [user])

  function finishTour() {
    void markOnboarded()
  }

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
        !tourOpen &&
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
    tourOpen,
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
      openWelcomeTour,
    }),
    [
      openNewContact,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAssistant,
      openWelcomeTour,
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
      <VoiceCaptureDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNewContact={openNewContact}
        onVoiceCapture={openVoiceCapture}
        onAssistant={openAssistant}
      />
      <WelcomeTour
        open={tourOpen}
        onOpenChange={setTourOpen}
        onDismiss={finishTour}
        onComplete={openNewContact}
      />
    </UIContext.Provider>
  )
}

export function useUI(): UIContextValue {
  const ctx = React.useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}
