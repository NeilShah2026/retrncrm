import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UIProvider } from '@/context/ui-context'
import { AssistantProvider } from '@/context/assistant-context'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { MobileWebGate } from '@/components/layout/MobileWebGate'
import { DashboardPage } from '@/pages/DashboardPage'
import { AssistantPage } from '@/pages/AssistantPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { ContactDetailPage } from '@/pages/ContactDetailPage'
import { TagsPage } from '@/pages/TagsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { CollegePage } from '@/pages/CollegePage'
import { CalendarPage } from '@/pages/CalendarPage'
import { MorePage } from '@/pages/MorePage'
import { QrPage } from '@/pages/QrPage'
import { TemplatesPage } from '@/pages/TemplatesPage'
import { LandingPage } from '@/pages/marketing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { AddContactPage } from '@/pages/AddContactPage'
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { ROUTES } from '@/lib/routes'
import { isNative } from '@/lib/platform'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      richColors
      closeButton
    />
  )
}

/**
 * The product surface (everything under /app). Gated by RequireAuth — signed
 * out visitors are redirected to /login. The global UI provider (command
 * palette, quick-add dialog, welcome tour) only mounts here, not on the
 * public marketing site or login screen.
 */
function AppEntry() {
  return (
    <RequireAuth>
      <AssistantProvider>
        <UIProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="contacts/:id" element={<ContactDetailPage />} />
              <Route path="college" element={<CollegePage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="qr" element={<QrPage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
            </Route>
          </Routes>
        </UIProvider>
      </AssistantProvider>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <AuthProvider>
          <BrowserRouter>
            {/* On a phone, on the app-only hosts, everything but the QR
                landing page and the legal pages gives way to "the app is
                coming". See MobileWebGate. */}
            <MobileWebGate>
              <Routes>
                {/* The marketing site is a "visit our website" pitch — inside
                    the native app there's no browser to have arrived from, so
                    "/" goes straight to the product (RequireAuth sends signed-
                    out visitors on to /login from there). */}
                <Route
                  path={ROUTES.home}
                  element={isNative ? <Navigate to={ROUTES.app} replace /> : <LandingPage />}
                />
                <Route path={ROUTES.login} element={<LoginPage />} />
                <Route path={ROUTES.add} element={<AddContactPage />} />
                <Route path={ROUTES.privacy} element={<PrivacyPolicyPage />} />
                <Route path={ROUTES.terms} element={<TermsPage />} />
                <Route path={`${ROUTES.app}/*`} element={<AppEntry />} />
                <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
              </Routes>
            </MobileWebGate>
          </BrowserRouter>
        </AuthProvider>
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
