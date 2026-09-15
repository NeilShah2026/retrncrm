# Retrn browser extension

Log emails and add people to your Retrn network without leaving your inbox or
LinkedIn.

- **Gmail and Outlook.** Open an email and a **Log to Retrn** button appears
  next to the subject. It opens a panel over the page that lists everyone on
  the thread: who's already in Retrn (with their role, when you were last in
  touch, whether they're past their catch-up goal, tags and recent history),
  and who's new. Log the email to one person or several at once; new people are
  added as contacts in the same step, with the company guessed from their
  address. The button switches to **Logged in Retrn** once a thread is on
  someone's timeline, and the panel marks who it's already logged to.
- **LinkedIn.** On a profile, add the person (title and company read from their
  headline) or fill in the contact you already have. In a conversation, log the
  message.
- **Anywhere else**, the toolbar popup searches your contacts.
- **Undo** on every save, and **Open in Retrn** for every contact.
- Matches people by email address, then LinkedIn URL, then name. A contact with
  the same name and no email yet is picked automatically, and logging to them
  fills in the address instead of creating a second copy. Nothing already on a
  contact is overwritten.
- Follows the system's light or dark appearance, in the web app's design.

Keyboard: **Alt+Shift+R** opens the popup; **Esc** closes the panel.

## How it works

```
content-mail.js   Gmail/Outlook page: reads the open email, adds the button,
                  frames panel.html over the page
panel.html        the app, inside that frame (talks to the page over a private
                  MessageChannel)
popup.html        the same app, from the toolbar icon
background.js     "is this thread already logged?" for the button, and
                  finishing magic-link sign-ins
signed-in.html    where a magic-link tab ends up
```

The UI is Preact (`src/app`). It reads and writes the same `contacts` and
`tags` tables as the web app, scoped to your account by row-level security,
and appends interactions exactly the way the web app does.

Page reading lives in `src/extract.ts` — one self-contained function, because
the popup also hands it to `chrome.scripting.executeScript` as source text.

### Signing in

The extension has **its own session**: enter your email and open the sign-in
link Retrn emails you, in the same browser (or use a password, if your account
has one). This works however the account was created — Google, Apple, magic
link or password.

The link is requested with PKCE and redirects to `https://www.retrncrm.com/app`
— the same place the website's own links go — with a one-time `?code=` on the
end. The background worker notices that tab (only while the extension is
waiting on a link), redeems the code with the verifier kept in the extension's
storage, and swaps the tab for `signed-in.html`. The website has no verifier
for that code, so it ignores it and the two sessions stay separate. The
Supabase **Magic Link** email template needs `{{ .ConfirmationURL }}`, which is
the default.

Versions before 0.3 copied the website's session instead. Supabase rotates
refresh tokens and treats a reused one as stolen, so two apps sharing one token
kept signing each other out — that's why sign-in stopped working. 0.3 discards
that copied session (without revoking it) and asks you to sign in once.
"Sign out of the extension" only signs out the extension.

### Config

`src/config.ts` holds the Supabase URL and the public anon key — the same
publishable values the web app ships — and the web app's origin. Any origin
the extension reads must also be listed in `host_permissions` in
`public/manifest.json`.

## Build & load

Prereqs: Node 18+.

```bash
cd extension
npm install
npm run typecheck
npm run build        # → extension/dist
npm run zip          # → retrn-extension.zip, for the Chrome Web Store
```

Load it in Chrome: `chrome://extensions` → **Developer mode** → **Load
unpacked** → select `extension/dist`. After changes, `npm run build` (or
`npm run watch`) and click ↻ on the extension card. Mail tabs that were already
open get the button without a reload.

Icons are rendered from the web app's brand mark (`public/favicon.svg`) by
`node scripts/icons.mjs`, which needs Playwright installed.

## Known limitations

- Gmail's and Outlook's markup changes without notice. Every selector in
  `src/extract.ts` has fallbacks; if an open email isn't detected, open the
  popup there and click **Copy page details**, which reports what matched.
- Outlook shows some recipients by name only, without an address; those people
  can't be matched or added from that email.
- Geist is bundled under the SIL Open Font License (`public/fonts/OFL.txt`).
