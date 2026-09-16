import * as React from 'react'
import { isNative } from '@/lib/platform'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  /** The actually-applied theme after resolving 'system'. */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'retrn-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? 'system'
  })

  const resolvedTheme = React.useMemo<'light' | 'dark'>(() => {
    return theme === 'system' ? getSystemTheme() : theme
  }, [theme])

  // Apply the resolved theme to <html> and keep in sync with OS changes.
  React.useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const resolved = theme === 'system' ? getSystemTheme() : theme
      root.classList.toggle('dark', resolved === 'dark')
      if (isNative) {
        // Dynamically imported: this file is also part of the shared web
        // bundle, and a static import of the plugin would ship its JS
        // there even though `isNative` keeps it from ever running on web.
        void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
          // The plugin names its styles after the *background* they are for,
          // not the text they produce: `Style.Dark` is "light text for dark
          // backgrounds". So a dark theme takes Style.Dark — naming it the
          // other way round leaves the clock and battery near-black on a
          // near-black bar. Fails silently on the (rare) device/OS combo
          // without a status bar API; nothing else here depends on it.
          void StatusBar.setStyle({
            style: resolved === 'dark' ? Style.Dark : Style.Light,
          }).catch(() => {})
        })
      }
    }
    apply()

    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  const toggle = React.useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
