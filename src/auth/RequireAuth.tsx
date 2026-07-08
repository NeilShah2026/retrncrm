import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { ROUTES } from '@/lib/routes'

/** Gates the /app/* route tree — redirects to /login if not signed in. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to={ROUTES.login} replace />
  return <>{children}</>
}
