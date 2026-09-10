import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell config for the iOS build. The web app in `src/` is the single
 * source of truth for both web and iOS — this file only configures how the
 * *wrapper* behaves (status bar, keyboard, splash), never app logic.
 *
 * `webDir` points at the Vite production build output (`vite build` → `dist`),
 * so `npm run build && npx cap sync ios` is what ships a new native build.
 */
const config: CapacitorConfig = {
  appId: 'com.neilshah.retrn',
  appName: 'Retrn',
  webDir: 'dist',
  ios: {
    // The web layout already accounts for the notch/Dynamic Island and home
    // indicator via `env(safe-area-inset-*)` (see src/index.css), the same
    // way the PWA's `black-translucent` status bar style does — so the
    // WebView should draw edge-to-edge under the status bar, not be inset by
    // the OS a second time.
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      // We set the actual style (light content / dark content) at runtime
      // from the app's theme provider (src/components/theme-provider.tsx),
      // since it must track the user's light/dark choice, not a static value.
      overlaysWebView: true,
    },
    Keyboard: {
      // Matches the web build's `interactive-widget=resizes-content`: the
      // layout (100dvh flex columns) already expects the viewport to shrink
      // when the keyboard opens, so resizing the WebView body keeps that
      // behavior identical to Mobile Safari instead of floating the keyboard
      // over fixed-position content.
      resize: 'body',
      style: 'default',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config
