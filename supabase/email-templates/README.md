# Auth email templates

The HTML Supabase sends for sign-in, sign-up and the rest. Supabase keeps the
live copy in the dashboard (**Authentication → Emails**), which means there is
nothing in git to review and nothing to stop a change here from breaking an app
that reads the link. These files are the source of truth; the dashboard is a
copy of them.

That is not hypothetical. Repointing the Magic Link template at `/auth/confirm`
broke the browser extension's sign-in completely — links arrived and nothing in
the extension recognised them — and it stayed broken until someone read an
actual email. Hence the contract below.

| File                      | Dashboard template     | Sent when                                              |
| ------------------------- | ---------------------- | ------------------------------------------------------ |
| `magic-link.html`         | Magic Link             | `signInWithOtp` for an account that already exists      |
| `confirm-signup.html`     | Confirm signup         | `signUp`, and `signInWithOtp` for a new address         |
| `invite.html`             | Invite user            | an invite sent from the dashboard — unused today        |
| `change-email.html`       | Change Email Address   | `updateUser({ email })` — unwired today                 |
| `reset-password.html`     | Reset Password         | `resetPasswordForEmail` — unwired today                 |
| `reauthentication.html`   | Reauthentication       | a re-auth challenge — unwired today                     |

## The contract

**The link must keep this exact shape:**

```
https://www.retrncrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .SiteURL }}
```

Four things depend on it, and none of them fail loudly:

- **`/auth/confirm`, not Supabase's `{{ .ConfirmationURL }}`.** Supabase's own
  link signs you in the moment it is opened, and it works once. Babson is on
  Microsoft 365, which opens every link to scan it before the person sees the
  email — spending it, so their own click says "invalid or expired".
  `AuthConfirmPage` spends nothing until a button is tapped.
- **`token_hash`, not `code`.** The browser extension's background worker
  watches for this and redeems it for its own session. It matches on the
  `pkce_` prefix Supabase puts on the hash — the extension is the only client
  on the project using the PKCE flow, so a bare hash is a website or phone
  sign-in and it keeps its hands off. See `extension/src/auth.ts`.
- **`type=email`.** Supabase accepts it for both a magic link and a sign-up
  confirmation, which is why one value covers both templates. `email_change`
  and `recovery` are genuinely different grants and keep their own.
- **`next={{ .SiteURL }}`.** `resolveNext` reads the Site URL's `/` as "they
  just signed in, send them to `/app`". Note what this means: **`.RedirectTo`
  is ignored**, so an `emailRedirectTo` passed to `signInWithOtp` does not
  steer the link.

**`{{ .Token }}` has to stay in `magic-link.html` and `confirm-signup.html`.**
Settings → verify school email asks for a six-digit code, not a link, so
without it that flow has nothing to enter. It went missing from the live Magic
Link template at some point; these files put it back.

## Changing one

Copy the whole file into the dashboard field — they are standalone documents,
and the shared chrome is generated, so edit every file or none. Then, before
calling it done:

1. Send yourself a link from **the extension** and confirm the URL in the email
   still matches the shape above, `pkce_` prefix included.
2. Open it and confirm the extension signs in — not just the website.
3. Send one from the website sign-in page and confirm the extension leaves it
   alone.

## Design

Tokens come from `src/index.css`, resolved to hex because email has no custom
properties: near-black `#18181b` primary, `#0e0e11` text, `#4e4e56` body,
`#67676f` muted, `#e2e2e4` hairline, `#f4f4f5` sunken. One typographic
wordmark, no images — nothing to block, nothing to break. Dark values live in
the single `<style>` block; Apple Mail and iOS Mail honour it, Gmail and
Outlook ignore it and keep the light design, so the light design has to stand
on its own.

## Known gap

A school-email link (`startVerification`) asks for `emailRedirectTo:
/verify-edu`, but since `next` is the Site URL that redirect never happens —
the student lands on `/auth/confirm` and tapping through signs their browser in
*as the school address*, which is the session swap `eduVerification.ts` is
written to avoid. The code path is the documented one and works once
`{{ .Token }}` is back; the link path needs `AuthConfirmPage` to hand a
`/verify-edu` target on without spending it first. Not fixed here.
