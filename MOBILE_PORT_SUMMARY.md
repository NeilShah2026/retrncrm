# Mobile port: summary

Retrn now builds as a native iOS app via Capacitor, from the same `src/`
that ships the web app — no fork, no second codebase. This is the
end-of-session handoff: what's done and verified, what's committed, what
you need to do by hand, and what I'd personally still check on a real
phone before submitting.

## What's fully done and verified

**Capacitor project** — `@capacitor/core`/`cli`/`ios` installed, app ID
`com.neilshah.retrn`, name "Retrn", `webDir` → `dist`. `ios/` is a real,
buildable Xcode project (`ios/App/App.xcworkspace`). I built it
end-to-end with `xcodebuild ... -sdk iphonesimulator
CODE_SIGNING_ALLOWED=NO` after every commit — it links all 7 native
plugins and produces a working `.app` every time.

**App icon & splash** — generated from the same brand mark already used
for the PWA icons/apple-touch-icon (`public/favicon.svg`), rendered at
native resolution via a headless-Chromium script
(`scripts/generate-ios-assets.mjs`, re-runnable) since no SVG rasterizer
was available locally. The launch screen is appearance-aware (separate
light/dark images), matching the app's actual `--bg` tokens rather than a
generic white flash.

**Mobile UI audit** — see `MOBILE_PORT_NOTES.md` for the full list. Short
version: the app was already unusually mobile-first (a dedicated
`PageShell`/`MobileNavBar`/tab-bar architecture, safe-area insets, a
table→card swap on Contacts) before this port touched anything. Real gaps
found and fixed: a hover-only "Copy" button on the Assistant screen, the
"Add to Chrome" banner showing inside the native app, onboarding copy
telling phone users to press a keyboard shortcut, missing native
text-selection-callout suppression on controls, and two sub-44pt tap
targets (kebab menus, dialog close button) — all fixed with `git blame`-
able reasoning in the commit messages.

**Bottom tab bar** — already split correctly before this port: Home,
Contacts, Assistant, Calendar + More (5 items, at Apple's HIG cap), with
College/Pipeline/Templates/Tags/Settings in the More sheet. See
`MOBILE_PORT_NOTES.md` for the grouping rationale. I verified this
actually renders correctly at all three target widths (see Testing,
below) rather than just trusting the code.

**Native status bar / zoom / touch targets** — status bar style now
tracks the app's light/dark theme via `@capacitor/status-bar` (wasn't
wired to anything before Capacitor existed to wire it to); pinch-zoom and
double-tap-zoom are disabled natively only (`html.native` + `touch-action:
pan-x pan-y`, set at boot, never affecting the web build); `Button`'s
small icon size and the shared dialog close button now have an invisible
44×44pt hit area under a 28px glyph.

**Info.plist permissions** — `NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription`,
`NSSpeechRecognitionUsageDescription`, all written for App Review (they
say what the feature does, not generic boilerplate). Also: a
`com.neilshah.retrn://` URL scheme for auth redirects, an iPhone
portrait-only orientation lock (matching the PWA manifest's own
`"orientation": "portrait"` — nothing in this app was designed for
landscape), and `ITSAppUsesNonExemptEncryption=false` so App Store
Connect won't ask an export-compliance question on every upload.

I did **not** add `NSContactsUsageDescription` — the app has no feature
that reads or writes the iOS address book (its "contacts" are entirely
its own database). And there's no actual OCR/business-card-scanning
feature in the codebase today — the contact-photo picker
(`ContactFormDialog`) is a plain image picker, not text extraction. If
you want real OCR business-card capture, that's a new feature to design
and build, not something this port could infer and add on its own.

**Supabase auth & sync inside the WebView** — this is the part most
likely to have silently broken without deliberate fixes, so I made each
one actually work rather than flagging it:
- Google OAuth opens in the system browser (`@capacitor/browser`) instead
  of the embedded WebView, since Google blocks embedded WebViews outright.
- Google OAuth, magic links, and signup confirmation all redirect back
  through one custom URL scheme (`src/lib/nativeAuth.ts`), handled by a
  listener registered in `AuthProvider`.
- Session storage uses `@capacitor/preferences` (native `UserDefaults`)
  instead of WKWebView `localStorage`, per Supabase's own Capacitor
  guidance.
- Every relative `/api/*` call and every `window.location.origin`-built
  link (the iCal-subscribe URL, the share-profile QR code) now resolves
  through `src/lib/apiBase.ts` against the production origin on native,
  since there's no server behind `capacitor://localhost`.
- Voice capture (`VoiceCaptureDialog`) used the Web Speech API, which
  does not exist inside a WKWebView. `useSpeechRecognition` now branches
  to `@capacitor-community/speech-recognition` (on-device
  `SFSpeechRecognizer`) on native, same public interface either way.

**Bundle discipline** — every native-only import (all of the above) is a
dynamic `import()`, not a static one, so none of that plugin code ships
to the web build that this same bundle also serves. Confirmed via a
per-package chunk breakdown, not assumed.

## Testing — what I actually ran, and what I saw

I built three fresh simulators (iOS 26.5, the only runtime installed
here) and ran the real app in each, screenshotting rather than assuming:

- **iPhone SE (3rd gen)** — 375×667pt, the tightest width.
- **iPhone 16** — 393×852pt, standard width.
- **iPhone 16 Pro Max** — 430×932pt, the widest phone.

What I verified visually, on-device, across all three:
- The sign-in screen renders correctly — no clipped content, correct
  fonts, correct safe-area clearance under the notch/Dynamic Island
  (confirmed on both notched sizes and the home-button SE).
- The native root route skips the marketing landing page and goes
  straight to `/login` (no session) — confirmed, not assumed.
- The 5-item tab bar (Home/Contacts/Assistant/Calendar/More) fits
  comfortably even on the SE's 375pt width, with readable labels and
  correct bottom clearance.
- The nav bar (logo, search, new-contact icons), skeleton loading state,
  and the "still loading — reload" slow-network state all render cleanly
  on-phone.

I couldn't get real Supabase credentials working here (see the flag
below), so I couldn't sign in for real. To still verify the authenticated
shell — the tab bar, nav bar, and loading states above — I temporarily
short-circuited `RequireAuth` to render past the login gate, screenshotted
it, and **reverted that change completely** before the final commit
(`git diff` against every commit here is clean — nothing testing-only
ended up shipped).

One genuinely useful thing this caught: my first few simulator runs
looked badly broken — content cut off past the right edge of the screen,
a garbled logo. I chased it as a real CSS/viewport bug for a while before
realizing it was a stale WKWebView process left over from using
`simctl terminate` + `simctl launch` instead of a full `uninstall` +
`install` between test builds — a full reinstall each time fixed it, and
a diagnostic overlay confirmed the actual viewport math (`375×667`, `dpr:2`,
no scroll overflow) was correct the whole time. Worth knowing if you hit
the same "broken" look while iterating in Simulator yourself — reinstall,
don't just relaunch.

### What I could not verify (needs a real device or real credentials)

- **Actually completing sign-in** — Google OAuth round-trip, a magic
  link, or a signup confirmation, end to end. The code follows Supabase's
  documented native pattern, but I have no real Supabase project or
  Google OAuth client to run it against.
- **Voice dictation actually transcribing** — the native
  `SpeechRecognition` branch is implemented against the plugin's
  documented API, but I can't tap a mic button and speak into a
  simulator from here.
- **Camera / photo library picker's native UI** — Apple documents that
  `<input type=file>` triggers the native picker inside a WKWebView with
  the right Info.plist keys, but I didn't get to tap through it.
- **Keyboard scroll-into-view in a real typing session** — implemented
  via a `Keyboard.addListener('keyboardWillShow', ...)` that scrolls the
  focused field into view; I saw the keyboard open and cover the bottom
  of forms correctly in screenshots, but didn't type through a full
  contact-add flow to confirm the auto-scroll itself fires.
- **Status bar style actually flipping with the in-app theme toggle** —
  the code path is the same one that already correctly toggles the `dark`
  class (which I did visually confirm applies), but I didn't screenshot a
  before/after of toggling theme in Settings/More.

## What's committed, and where

All on `main`, no force-pushes, nothing squashed:

1. `989e93c` — Capacitor install, iOS project, first simulator build.
2. `4424b76` — Generated app icon + light/dark splash screens.
3. `0a5e4c6` — Native auth (OAuth/magic-link/signup redirect), session
   storage, API base URL, native voice capture, Info.plist permissions.
4. `ff1de15` — Status bar sync, native pinch/zoom disabling, touch
   targets, and the mobile-reachability bugs the audit found.
5. `7c6be2c` — Lazy-loading native plugin code out of the web bundle,
   plus `MOBILE_PORT_NOTES.md` (the full audit).

## What you need to do manually

Numbered in the order you'll hit them:

1. **Check `.env.local`.** Early on I ran `cp .env.example .env.local` to
   unblock a production build, and only later noticed I can't tell
   whether that overwrote real credentials you already had there (it's
   gitignored, so there's no git history to check). I've since put
   obviously-fake placeholder values in it
   (`VITE_SUPABASE_URL=https://placeholder-for-simulator-ui-testing.supabase.co`)
   purely so I could get the app past its own "missing config" guard to
   test the UI. **Re-paste your real `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`** (Supabase dashboard → Project Settings →
   API) before you build again. Sorry for not checking first — I should
   have looked for an existing file before overwriting it.

2. **Add the native redirect URL in Supabase.** Dashboard → Authentication
   → URL Configuration → Redirect URLs → add
   `com.neilshah.retrn://login-callback`. Without this, Google OAuth,
   magic links, and signup confirmation will all fail on native (Supabase
   refuses to redirect to an un-allow-listed URL). I don't have dashboard
   access to do this myself.

3. **Confirm the production API origin.** `src/lib/apiBase.ts` hardcodes
   `https://retrncrm.com` as where native builds send `/api/ai`,
   `/api/verify-edu`, the iCal feed, and share-profile links — I inferred
   this from `extension/src/config.ts` and `extension/README.md` (the
   browser extension's own allow-listed domains), not from a Vercel
   dashboard I don't have access to. If your actual production domain is
   different, update that one constant.

4. **Open the project in Xcode and set up signing** — this needs the
   Xcode GUI and your Apple Developer account, neither of which I have
   here:
   - `open ios/App/App.xcworkspace`
   - Select the `App` target → Signing & Capabilities → pick your Team,
     let Xcode manage signing automatically (or set up a manual
     provisioning profile for `com.neilshah.retrn` if you prefer).
   - Build once for a real device (⌘R with a device selected) to confirm
     the profile actually resolves.

5. **Check Apple's Sign in with Apple requirement.** The login screen
   offers "Continue with Google." Apple's App Review Guideline 4.8
   generally requires offering Sign in with Apple as an equivalent option
   whenever you offer another third-party social login on iOS. This
   wasn't something I could add without your Apple Developer account (it
   needs a capability enabled in the portal + Xcode), but it's worth
   checking before you submit — Google-only sign-in is a common rejection
   reason.

6. **TestFlight / App Store, when you're ready:**
   - Product → Archive in Xcode (or `xcodebuild archive` from the CLI
     with real signing).
   - Window → Organizer → Distribute App → App Store Connect.
   - In App Store Connect: fill in the listing, screenshots (you have
     three device sizes' worth from this session if you want a starting
     point — they're not final marketing screenshots, just functional
     verification), and the privacy "nutrition label" — declare Camera,
     Microphone, and Speech Recognition usage to match the Info.plist
     strings.
   - Submit for review.

7. **Optional, if you want share links to open in the app instead of
   Safari:** set up an Associated Domains entitlement + host an
   `apple-app-site-association` file on `retrncrm.com`, so the
   share-profile QR code and email confirmation links become Universal
   Links instead of opening in the system browser. I didn't build this —
   it needs your Apple Developer Team ID and control over the production
   domain's server config, both outside what I have here. Not required
   for the app to work today (those links already correctly point at
   your real domain and open fine in Safari), just a nicer-feeling
   upgrade later.

## What needs a physical device specifically (not just Xcode/Developer access)

- **Face ID/Touch ID** — not currently used anywhere in the app, so
  nothing to test, but flagging in case you add biometric re-auth later.
- **Real camera and microphone capture** — the Simulator can pass through
  your Mac's own camera/mic in some configurations, but the honest,
  reliable test is a real device: take an actual contact photo, actually
  dictate a contact by voice, and read exactly what permission-prompt
  wording iOS shows against the strings I wrote in Info.plist.
- **The actual OAuth/magic-link/deep-link round trip**, once you've
  allow-listed the redirect URL (item 2 above) — opening Safari, signing
  in, and getting handed back to the app is worth doing on a device where
  you also have Mail/Safari configured normally.
- **TestFlight install and update flow** — first-run behavior, especially
  around the splash screen and any first-launch permission prompts,
  should get a look after a real TestFlight install rather than only a
  Simulator build.
- **Performance/thermals on older hardware** — an SE-*class* screen size
  in Simulator tells you about layout, not about how the actual bundle
  (1.2MB gzip: 362KB — see the note in commit `7c6be2c` about why that
  number is what it is, not a regression) performs on an actual A15-or-
  older chip.
