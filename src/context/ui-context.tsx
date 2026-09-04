import * as React from 'react'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { VoiceCaptureDialog } from '@/components/contacts/VoiceCaptureDialog'
import { CommandPalette } from '@/components/search/CommandPalette'
import { AskNetworkDialog } from '@/components/ai/AskNetworkDialog'
import { WelcomeTour } from '@/components/onboarding/WelcomeTour'
import { useAuth } from '@/auth/AuthProvider'
import type { Contact } from '@/types'

interface UIContextValue {
  openNewContact: () => void
  /** The one-sentence capture sheet — the low-friction way to add someone. */
  openVoiceCapture: () => void
  openEditContact: (contact: Contact) => void
  openSearch: () => void
  /** Natural-language search over your contacts, optionally pre-filled. */
  openAskNetwork: (question?: string) => void
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
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [tourOpen, setTourOpen] = React.useState(false)
  const [voiceOpen, setVoiceOpen] = React.useState(false)
  const [askOpen, setAskOpen] = React.useState(false)
  const [askQuestion, setAskQuestion] = React.useState<string | undefined>()

  const openNewContact = React.useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openEditContact = React.useCallback((contact: Contact) => {
    setEditing(contact)
    setFormOpen(true)
  }, [])

  const openVoiceCapture = React.useCallback(() => setVoiceOpen(true), [])
  const openAskNetwork = React.useCallback((question?: string) => {
    setAskQuestion(question)
    setAskOpen(true)
  }, [])
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
        !voiceOpen &&
        !askOpen
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
    askOpen,
    openNewContact,
    openVoiceCapture,
  ])

  const value = React.useMemo(
    () => ({
      openNewContact,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAskNetwork,
      openWelcomeTour,
    }),
    [
      openNewContact,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAskNetwork,
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
        onAskNetwork={openAskNetwork}
      />
      <AskNetworkDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        initialQuestion={askQuestion}
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
