# Mobile port: UI audit

What the desktop/browser-assumption audit (Step 2 of the iOS port) found,
and what changed as a result. The short version: this codebase already had
an unusually deliberate mobile-first architecture before this port started
— `PageShell`, the phone tab bar, safe-area handling, and the
table→card swap on Contacts were all already in place. The audit found a
handful of real gaps, listed below; everything else in this list was
checked and confirmed already correct.

### Bottom tab bar (already correctly scoped)

The task asked for the 8-item desktop nav (Dashboard, Contacts, College,
Pipeline, Calendar, Templates, Tags, Settings) to be split into ~4-5
primary tabs plus a "More" tab, since Apple's HIG caps a tab bar at about
5 visible items. `src/components/layout/AppLayout.tsx` already did exactly
this before this port touched anything:

- **Tab bar (`TAB_NAV`, 4 items + More = 5 total):** Home, Contacts,
  Assistant, Calendar, More.
- **More sheet (`MoreSheet.tsx`):** College, Pipeline, Templates, Tags,
  plus Settings, New contact, Search, Share profile, Sign out.

The grouping logic: the four tab-bar slots go to the destinations you'd
plausibly reach for *every day* — checking who's overdue (Home/Dashboard),
looking someone up (Contacts), asking the assistant something, or checking
what's on the calendar. College and Pipeline are real features but
lower-frequency for most sessions (checked when actively job-hunting, not
daily); Templates and Tags are utility screens you visit in service of
another task, not destinations on their own. That's a reasonable split and
was left as-is rather than redesigned.

## Already handled before this port (confirmed, not touched)

- **`src/components/layout/PageShell.tsx`** gives every screen either a
  desktop header or an iOS-style `MobileNavBar` (`src/components/layout/MobileNavBar.tsx`)
  — never both, never neither.
- **`src/components/layout/AppLayout.tsx`** already had a real iOS tab bar
  (`TAB_NAV`) plus a `MoreSheet` for overflow — see
  [Bottom tab bar](#bottom-tab-bar-already-correctly-scoped) above.
- **Safe areas**: `env(safe-area-inset-*)` already used throughout
  (`MobileNavBar`, the phone tab bar, `DialogContent`'s bottom-sheet
  padding, `MoreSheet`).
- **`src/pages/ContactsPage.tsx`**: the desktop `ContactsTable.tsx` (fixed
  `min-w-[840px]`) is never rendered on a phone — `useIsMobile()` swaps it
  for `ContactListRow` cards instead.
- **16px input font on mobile** (`src/index.css`) so iOS doesn't zoom the
  page when a field is focused.
- **`touch-action: manipulation`** and tap-highlight removal already
  applied to buttons/links under `@media (hover: none)`.
- **`overscroll-behavior: none`** on `html, body` so rubber-banding
  doesn't leak between scroll regions.
- Every page under `AppLayout` (Dashboard, College, Calendar, Templates,
  Tags, Settings, Contact detail, Assistant) already passes a `mobile={{…}}`
  `PageShell` prop or otherwise renders its own mobile chrome — none were
  desktop-only.
- Grids beyond 2 columns (contact/opportunity forms, the contacts grid
  view) already carry responsive `sm:`/`xl:` prefixes that collapse to 1
  column on a phone.
- Most hover-reveal action buttons (`ContactCard`, `ContactDetailPage`,
  `PipelinePage`'s kebab menu) are already gated behind `md:` so they're
  fully visible by default on touch.

## Real gaps found and fixed

1. **`src/components/ai/AssistantChat.tsx`** — the "Copy answer" button
   under an assistant reply was `opacity-0` with only a `hover:`/
   `group-hover:` reveal and no `md:` gate — invisible and undiscoverable
   on a phone (Assistant is a fully mobile screen, not desktop-only).
   Fixed: gated behind `md:` like every other hover-reveal action in the
   app, so it's visible by default on touch.

2. **`src/components/layout/ExtensionBanner.tsx`** — an unconditional
   "Add to Chrome" prompt for the browser extension, mounted for every
   screen size including phone widths. Inside the native app there's no
   browser to extend. Fixed: suppressed entirely when `isNative` (see
   `src/lib/platform.ts`).

3. **`src/components/onboarding/WelcomeTour.tsx`** — the "Capture" step's
   copy told every user, phone or desktop, to "Press N anywhere to add
   someone" — a keyboard shortcut with no touchscreen equivalent. Fixed:
   conditioned on `useIsMobile()`, phone copy instead points at the +
   button.

4. **Hover-only text-selection callout on controls** — buttons and
   `[role=button]` elements didn't suppress iOS's long-press
   copy/selection callout the way the `.chrome` utility already did for
   nav/structural elements. Extended the existing `@media (hover: none)`
   rule in `src/index.css` to add `-webkit-touch-callout: none` there too
   — a control never has text worth selecting.

5. **`src/components/theme-provider.tsx`** had nothing wired to a native
   status bar API (there wasn't one to wire to before Capacitor). Now
   calls `@capacitor/status-bar`'s `setStyle` in the same effect that
   toggles the `dark` class, so the iOS status bar tracks the resolved
   theme (including a manual in-app override, not just the OS setting).

6. **Touch targets under 44×44pt**: `Button`'s `icon-sm` size (28px, used
   for every kebab/overflow menu trigger) and the shared `Dialog` close
   button (also 28px) were visually correct for their density but under
   Apple's HIG minimum tap target. Fixed with an invisible `::before`
   hit-slop expanding the *tap* area to 44×44pt without changing the
   visible glyph size — see `src/components/ui/button.tsx` and
   `src/components/ui/dialog.tsx`.

7. **Native-only pinch-zoom / double-tap-zoom** — nothing disabled these
   before (reasonably so — it was a PWA that keeps normal browser zoom).
   Added a `native` class set once at boot
   (`src/lib/nativeBootstrap.ts`) and a scoped `touch-action: pan-x pan-y`
   rule in `src/index.css`, active only inside the native shell. The
   viewport meta tag itself is untouched (it's shared with the web build).

## Deliberately *not* changed

- **`src/pages/PipelinePage.tsx`'s HTML5 drag-and-drop** — `draggable`/
  `onDragStart`/`onDrop` doesn't work via touch, and won't inside a
  WKWebView either. Not fixed, because it doesn't need to be: every
  `OpportunityCard` already has a non-drag "Move to" action in its kebab
  menu (`DropdownMenuLabel>Move to</DropdownMenuLabel>` in
  `PipelinePage.tsx`), so touch users have always had a fully working
  path to the same action. The board still *looks* draggable on a phone
  (cursor: grab, etc.) but nothing breaks if a touch never actually
  triggers HTML5 DnD — the columns scroll with `snap-x snap-mandatory`
  either way.
- **`src/pages/NetworkPage.tsx`'s graph canvas** — already uses Pointer
  Events (`onPointerDown`, not `onMouseDown`), so it already receives
  touch input correctly. No changes needed.
- **`src/components/search/CommandPalette.tsx`** — fully tap-operable
  (type + tap a `CommandItem`); the `⌘K`/`N`/`V` shortcut badges shown
  next to some items are cosmetic and don't block tapping.

## Non-CSS/JS items (Steps 3–5, referenced here for completeness)

- Relative `/api/ai`, `/api/verify-edu` fetches, and every
  `window.location.origin`-built link (the iCal subscribe URL, the
  share-profile QR code) had nothing to resolve against inside the native
  shell — see `src/lib/apiBase.ts` and its callers.
- Google OAuth, magic links, and signup confirmation needed a native
  redirect path — see `src/lib/nativeAuth.ts`.
- Voice capture used the Web Speech API, unavailable inside a WKWebView —
  see `src/hooks/useSpeechRecognition.ts`'s native branch.

None of the app's actual product surface (contact model, pipeline,
templates, AI features, calendar sync) needed to change — this was
entirely a shell/chrome/plumbing problem, not a rewrite.
