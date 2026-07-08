import * as React from 'react'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { CommandPalette } from '@/components/search/CommandPalette'
import { WelcomeTour } from '@/components/onboarding/WelcomeTour'
import type { Contact } from '@/types'

interface UIContextValue {
  openNewContact: () => void
  openEditContact: (contact: Contact) => void
  openSearch: () => void
  openWelcomeTour: () => void
}

const UIContext = React.createContext<UIContextValue | null>(null)

const ONBOARDED_KEY = 'retrn-onboarded'

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
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [tourOpen, setTourOpen] = React.useState(false)

  const openNewContact = React.useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openEditContact = React.useCallback((contact: Contact) => {
    setEditing(contact)
    setFormOpen(true)
  }, [])

  const openSearch = React.useCallback(() => setSearchOpen(true), [])
  const openWelcomeTour = React.useCallback(() => setTourOpen(true), [])

  // Show the welcome tour automatically the very first time someone reaches
  // the app in this browser.
  React.useEffect(() => {
    if (!localStorage.getItem(ONBOARDED_KEY)) setTourOpen(true)
  }, [])

  function finishTour() {
    localStorage.setItem(ONBOARDED_KEY, '1')
  }

  // Global keyboard shortcuts: Cmd/Ctrl+K → search, "N" → new contact.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return
      }
      if (
        e.key.toLowerCase() === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        !formOpen &&
        !searchOpen &&
        !tourOpen
      ) {
        e.preventDefault()
        openNewContact()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [formOpen, searchOpen, tourOpen, openNewContact])

  const value = React.useMemo(
    () => ({ openNewContact, openEditContact, openSearch, openWelcomeTour }),
    [openNewContact, openEditContact, openSearch, openWelcomeTour],
  )

  return (
    <UIContext.Provider value={value}>
      {children}
      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
      />
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNewContact={openNewContact}
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
