import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog'
import { VoiceCaptureDialog } from '@/components/contacts/VoiceCaptureDialog'
import { QuickAddSheet } from '@/components/contacts/QuickAddSheet'
import { ImportContactsDialog } from '@/components/contacts/ImportContactsDialog'
import { UpgradeDialog } from '@/components/billing/UpgradeDialog'
import { onContactLimit } from '@/lib/billing/contactLimit'
import { planAllows, type Feature } from '@/lib/billing/features'
import { entitlementFor } from '@/hooks/useEntitlement'
import { useSubscription } from '@/hooks/useSubscription'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CommandPalette } from '@/components/search/CommandPalette'
import { useAuth } from '@/auth/AuthProvider'
import { hasOnboarded } from '@/lib/onboarding'
import { useAssistant } from '@/context/assistant-context'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

interface UIContextValue {
  openNewContact: () => void
  /** The full contact form, pre-filled — a scanned business card, say. */
  openNewContactWith: (prefill: Partial<Contact>) => void
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
  /** Bring people in from the phone's Contacts or a .vcf file. */
  openImportContacts: () => void
  /**
   * The upgrade prompt: shown at the contact limit (by itself), when a paid
   * feature is reached, or from Settings' test button (`preview`).
   */
  openUpgrade: (options?: { preview?: boolean; feature?: Feature }) => void
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
  const { subscription } = useSubscription()
  const navigate = useNavigate()
  const { handOff } = useAssistant()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [prefill, setPrefill] = React.useState<Partial<Contact> | undefined>()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [voiceOpen, setVoiceOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [upgrade, setUpgrade] = React.useState<{
    open: boolean
    preview: boolean
    feature?: Feature
  }>({ open: false, preview: false })
  const isMobile = useIsMobile()

  const openNewContact = React.useCallback(() => {
    setEditing(null)
    setPrefill(undefined)
    setFormOpen(true)
  }, [])

  const openNewContactWith = React.useCallback((next: Partial<Contact>) => {
    setEditing(null)
    setPrefill(next)
    setFormOpen(true)
  }, [])

  const openEditContact = React.useCallback((contact: Contact) => {
    setEditing(contact)
    setFormOpen(true)
  }, [])

  // Capture is a paid feature, and this is the only door to it — the
  // dashboard button, the tab bar, the "V" shortcut and the command palette
  // all come through here.
  const openVoiceCapture = React.useCallback(() => {
    if (!planAllows(entitlementFor(user, subscription).plan, 'capture')) {
      setUpgrade({ open: true, preview: false, feature: 'capture' })
      return
    }
    setVoiceOpen(true)
  }, [user, subscription])
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
  const openImportContacts = React.useCallback(() => setImportOpen(true), [])
  const openUpgrade = React.useCallback(
    (options?: { preview?: boolean; feature?: Feature }) =>
      setUpgrade({ open: true, preview: Boolean(options?.preview), feature: options?.feature }),
    [],
  )

  // Any add that the free plan refuses — from any dialog, import or the
  // assistant — lands here. Whatever form was open closes first, so the
  // prompt isn't stacked on top of it.
  React.useEffect(
    () =>
      onContactLimit(() => {
        setFormOpen(false)
        setVoiceOpen(false)
        setImportOpen(false)
        setUpgrade({ open: true, preview: false, feature: undefined })
      }),
    [],
  )
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
      openNewContactWith,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAssistant,
      openOnboarding,
      openImportContacts,
      openUpgrade,
    }),
    [
      openUpgrade,
      openNewContact,
      openNewContactWith,
      openVoiceCapture,
      openEditContact,
      openSearch,
      openAssistant,
      openOnboarding,
      openImportContacts,
    ],
  )

  return (
    <UIContext.Provider value={value}>
      {children}
      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        prefill={prefill}
      />
      {/* A phone gets the two-field sheet — name, where you met, a small mic.
          A desktop keeps the one-sentence capture with its review step. */}
      {isMobile ? (
        <QuickAddSheet
          open={voiceOpen}
          onOpenChange={setVoiceOpen}
          onCardScanned={(fields) => {
            setVoiceOpen(false)
            openNewContactWith(fields)
          }}
        />
      ) : (
        <VoiceCaptureDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
      )}
      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} />
      <UpgradeDialog
        open={upgrade.open}
        preview={upgrade.preview}
        feature={upgrade.feature}
        onOpenChange={(open) => setUpgrade((u) => ({ ...u, open }))}
      />
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
