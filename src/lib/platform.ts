import { Capacitor } from '@capacitor/core'

/**
 * True when running inside the native iOS (or Android) shell, as opposed to
 * a browser tab or the installed PWA. Both of those still run this exact
 * bundle — this is the one flag that tells web-only affordances (the
 * "install our Chrome extension" banner, relative `/api/*` calls that need a
 * real host, `<meta name="theme-color">`) to step aside for native ones
 * (the StatusBar plugin, an absolute API base URL, deep-link auth).
 */
export const isNative = Capacitor.isNativePlatform()

export const nativePlatform = Capacitor.getPlatform() as 'ios' | 'android' | 'web'

export const isIOS = nativePlatform === 'ios'
