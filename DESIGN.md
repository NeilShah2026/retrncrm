# Retrn design system

Retrn is a student-first personal CRM. The interface should feel like a
well-made tool — Linear's density, Stripe's restraint, Attio's tables —
not like a generated SaaS template. This file is the source of truth for
how it looks and behaves. Tokens live in `src/index.css` (CSS variables),
are exposed in `tailwind.config.js`, and the few numbers JavaScript needs
are in `src/lib/design-tokens.ts`.

If you are an AI editing this codebase: read the **Anti-patterns** section
before touching any `.tsx`. Every item there was removed on purpose.

---

## 1. Color

Neutrals carry ~90% of the interface. One brand accent is punctuation.
Status colours mean something.

| Token             | Light                   | Use                                          |
| ----------------- | ----------------------- | -------------------------------------------- |
| `bg`              | white                   | page canvas                                  |
| `bg-elevated`     | white                   | panels, popovers, dialogs                    |
| `bg-sunken`       | 96% grey                | table headers, hover rows, skeletons, tints  |
| `border`          | 89% grey                | hairlines — the primary elevation device     |
| `border-subtle`   | 93% grey                | dividers inside a panel                      |
| `border-strong`   | 78% grey                | hovered inputs, scrollbar thumbs             |
| `text`            | near-black              | body                                         |
| `text-secondary`  | 32% grey                | labels, secondary copy                       |
| `text-muted`      | 42% grey (5.6:1 on white) | captions, metadata — still AA at 11px      |
| `primary`         | near-black              | the one primary button per region            |
| `brand`           | blue `hsl(217 80% 46%)` | **only** the list below                      |
| `success` `warning` `danger` `info` | muted | status text/badges; each has a `-soft` tint |

### Where `brand` is allowed

- focus-visible rings
- the selected navigation item
- inline links
- the `Suggested` badge on model output
- the calendar's today marker
- `::selection`

Everywhere else — icons, headers, panel borders, empty states, "AI"
features — is a neutral. Tailwind classes to use: `text-brand`, `bg-brand/10`,
`ring-brand`. Never `indigo-*`, `violet-*`, `fuchsia-*`, `purple-*`.

Dark mode flips the same tokens (`.dark` in `index.css`). Marketing uses the
same tokens as the app; there is no second palette.

## 2. Typography

One family: **Geist** (Google Fonts, `index.html`), system sans fallback.
No serif anywhere. No display face used as "AI theater".

| Role          | Size / line | Class                              |
| ------------- | ----------- | ---------------------------------- |
| caption       | 11 / 16     | `text-xs`                          |
| UI            | 13 / 20     | `text-sm` — default for app chrome |
| body          | 14 / 22     | `text-base`                        |
| section       | 16 / 24     | `text-lg font-semibold`            |
| page title    | 20 / 28     | `text-xl font-semibold`            |
| dialog/hero   | 22–28       | `text-2xl` / `text-3xl`            |
| marketing display | 40–56   | `text-display` utility (−0.03em)   |

- Counts, dates, deadlines: `tabular-nums` (`.tnum` or `<time>`).
- Uppercase labels: `.text-label` (11px, +0.04em).
- Large display: negative tracking; small caps: positive.

## 3. Shape and elevation

| Role     | Radius | Tailwind        |
| -------- | ------ | --------------- |
| control  | 6px    | `rounded-md`    |
| card     | 8px    | `rounded-lg`    |
| modal    | 10px   | `rounded-modal` |
| pill     | full   | `rounded-full` — tags, avatars, the ⌘K kbd only |

Elevation is a 1px hairline and a background shift. Shadows exist only on
floating layers: `shadow-popover` (menus, popovers, selects) and
`shadow-modal` (dialogs, ⌘K). A list row, a card, a panel never has a
shadow, and a card never contains another card — use `PanelSection`.

## 4. Spacing and density

4px grid. App list surfaces are dense:

- table / list rows: 36px (`DENSITY.row`)
- ⌘K rows: 36px; menu items: 32px
- controls: 32px default, 28px small, 36px large
- sidebar: 224px, nav items 32px
- page header: `pt-5 pb-3`; body: `py-5`

Marketing varies its section padding on purpose (`py-16`, `py-20`,
`py-24`) — never the same value on every block.

## 5. Motion

- `--duration-fast` 120ms: hover, press, opacity
- `--duration-base` 160ms: opens, closes
- ease-out for opens (`--ease-out`)
- Skeletons match the final layout and are gated: after 2s (`LOADING_TIMEOUT_MS`)
  `NetworkGate` shows "still loading + reload", and any fetch error shows
  `ErrorState` with retry.
- `prefers-reduced-motion` disables everything globally (`index.css`).
- No scroll-triggered fade-ups, no hover `scale()`, no floating/tilting.

## 6. Iconography and model output

- One outline set: lucide. Enumerated fields use `src/lib/icons.ts`, not emoji.
- Model output is marked with the text badge `<SuggestedBadge>` — never a
  sparkle, wand, or magic icon in chrome.
- Capture is text-first. The microphone is a secondary control that sits
  after the text field and asks for permission on tap, never on open.

## 7. Components

Prefer changing these over one-off page CSS:

| Component      | File                                  | Notes |
| -------------- | ------------------------------------- | ----- |
| Button         | `ui/button.tsx`                       | 6 variants, `loading` prop, all states |
| Panel          | `ui/card.tsx` (`Panel`, `PanelHeader`, `PanelSection`; `Card` alias) | hairline, no shadow |
| Input/Textarea | `ui/input.tsx`, `ui/textarea.tsx`     | brand ring on focus, `aria-invalid` |
| Badge          | `ui/badge.tsx`                        | status variants + `SuggestedBadge` |
| Dialog         | `ui/dialog.tsx`                       | 10px radius; bottom sheet on phone |
| EmptyState     | `common/EmptyState.tsx`               | `first-run` / `zero` / `no-results`; `ErrorState`, `SlowState` |
| NetworkGate    | `common/NetworkGate.tsx`              | wraps every collection |
| ConfirmDialog  | `common/ConfirmDialog.tsx`            | `confirmWord` for irreversible actions |
| PageShell      | `layout/PageShell.tsx`                | pinned header + scrolling body |

Every interactive element has: default, hover, focus-visible, active,
disabled, loading (where it can be pending).

## 8. Content

Voice: a student who networks and is specific about it. Name the object and
the next action.

- Empty: "No contacts match “fintech”. Clear filters or add someone."
- Capture: "Type who you met. We’ll turn it into a contact."
- Assistant: "Ask about your network."
- Placeholders are neutral: "Name, where you met, anything useful" — not a
  fake story with a fake name.

Banned words and phrases: *What can I help you with?*, *We fill in the
rest*, *seamless*, *unlock*, *transform*, *supercharge*, *magic*, the
sparkle emoji, *Jane Doe*, *Acme*.

---

## Anti-patterns (never ship)

1. Indigo/violet ambient gradients, glow blobs, orbit graphics, twinkling stars.
2. Sparkle / wand icons as chrome (nav, headers, badges, buttons).
3. Generic AI copy (see banned list) or mysticism about what the model does.
4. Voice-first capture with a large microphone; auto-starting the mic.
5. The dashboard recipe: 4 equal KPI cards + glowing briefing + chip row.
6. A brand hue on unrelated controls (checkboxes, icons, every button).
7. Identical soft cards everywhere: 12–16px radius + drop shadow.
8. Serif type used only in one "AI" surface; any second font family.
9. Marketing on a different palette from the app.
10. Skeletons with no timeout; `[]` on error masquerading as empty.
11. Demo placeholders that read as generated (Jane Doe, Acme, canned stories).
12. Scroll fade-up on every section, hover `scale(1.05)`, glass panels, 3D tilt.
13. Nested cards; a shadow on a list row.
14. Emoji as data icons in rows or timelines.

## QA checklist

- [ ] No `Sparkles`/`WandSparkles` in nav or chrome: `grep -rn "Sparkles" src`
- [ ] No hard-coded hue: `grep -rnE "indigo-|violet-|fuchsia-|purple-" src`
- [ ] No `rounded-xl`/`rounded-2xl` in `src/pages` or app components
- [ ] Marketing and app import the same tokens (no `bg-[#…]` in `src`)
- [ ] Dashboard: metric strip, not four cards
- [ ] Assistant: sans headline, no sparkle, text-first composer
- [ ] Contacts: dense table by default; empty state offers three ways in
- [ ] Every collection renders through `NetworkGate`
- [ ] Tab through a page: brand rings visible on every control
- [ ] Reduced motion: nothing moves
- [ ] ⌘K finds a contact by name, a tag, a company; runs an action
- [ ] Say who you met: textarea first, mic secondary
- [ ] Muted text ≥ 4.5:1 on its background
