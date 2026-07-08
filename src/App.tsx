import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UIProvider } from '@/context/ui-context'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { ContactDetailPage } from '@/pages/ContactDetailPage'
import { TagsPage } from '@/pages/TagsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { TemplatesPage } from '@/pages/TemplatesPage'
import { LandingPage } from '@/pages/marketing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ROUTES } from '@/lib/routes'

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
      <UIProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/:id" element={<ContactDetailPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Route>
        </Routes>
      </UIProvider>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path={ROUTES.home} element={<LandingPage />} />
              <Route path={ROUTES.login} element={<LoginPage />} />
              <Route path={`${ROUTES.app}/*`} element={<AppEntry />} />
              <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
