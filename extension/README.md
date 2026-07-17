# Retrn browser extension

Log emails and add people to your Retrn network without leaving your inbox or
LinkedIn:

- **Gmail / Outlook** — log the open email to that person's contact. On a thread
  with several people, pick who it's with. The interaction stores a link back to
  the email ("Open source ↗" in the contact's timeline).
- **LinkedIn profile** — add or update a contact from a profile (name, headline,
  company, profile URL), optionally logging a "Connected on LinkedIn" touch.
- **LinkedIn DMs** — log a message to the conversation partner's contact.
- **Smart matching** — matches by email, LinkedIn URL, or name. If you already
  have the person but never saved their email, logging to them fills it in.

This is a Manifest V3 extension. The popup is a small vanilla-TS app that talks
directly to your Supabase project (the same backend as the web app), scoped to
your account by row-level security.

## How it works

```
Toolbar icon → popup
  ├─ chrome.scripting.executeScript → reads the open email from the page DOM
  ├─ @supabase/supabase-js → looks up the contact by email
  └─ appends an interaction (or creates the contact, then logs)
```

- **Auth (SSO):** click **Connect with Retrn** and the extension reuses the
  session you're already signed into on the web app — no second login, and it
  works no matter how you signed in (Google, magic link, or password). It reads
  the Supabase session from an open Retrn tab; if none is open, it opens one and
  asks you to sign in, then reconnect. A **password** fallback is also available.
  - Works across multiple origins listed in `RETRN_APP_URLS` in `src/config.ts`
    (production `https://retrncrm.com` / `https://www.retrncrm.com` and local
    `http://localhost:5173` are included). Each origin must also appear in
    `host_permissions` in `public/manifest.json`. Add new domains to **both**.
- **Config:** `src/config.ts` holds the Supabase URL and the **public anon key**
  — the same publishable key the web app ships, safe to include.

## Build & load (local testing)

Prereqs: Node 18+.

```bash
cd extension
npm install
npm run build        # bundles into extension/dist
```

Then load it in Chrome:

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. Pin the Retrn icon (puzzle-piece menu → pin).

Use it:

1. Make sure you're signed into the Retrn web app in a tab (for one-click SSO).
2. Open an email in Gmail or Outlook. *(If you installed the extension while a
   mail tab was already open, refresh that tab once.)*
3. Click the Retrn toolbar icon.
4. First time: click **Connect with Retrn** (or use the password fallback). Then
   confirm the type/date/summary and click **Log**.

Rebuild after code changes with `npm run build` (or `npm run watch` for an
auto-rebuild; click the ↻ on the extension card in `chrome://extensions` to pick
up changes).

## Known limitations

- Page reading (`src/popup.ts` → `extractPageContext`) depends on each site's
  DOM. **Gmail** is solid; **Outlook** and **LinkedIn** use several fallback
  strategies (LinkedIn leans on the page title, which is stable) but may still
  need selector tweaks when those sites change their markup.
- If a page isn't detected, open the popup there and click **Copy debug info** —
  it copies a snapshot (URL, title, what selectors matched) you can send so the
  selectors can be fixed for that layout.
- The placeholder icons in `public/icons/` are plain squares — replace them with
  a real logo before publishing.

## Publishing to the Chrome Web Store

1. **Developer account.** Register once at the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   ($5 one-time fee).
2. **Package.** From `extension/`, run:
   ```bash
   npm run zip        # builds and writes retrn-extension.zip
   ```
3. **Create the item.** In the dashboard → **Add new item** → upload the zip.
4. **Fill the listing:**
   - Name, short + detailed description, category (Productivity).
   - **Icon:** a 128×128 PNG (replace the placeholder first).
   - **Screenshots:** at least one 1280×800 (or 640×400) — e.g., the popup over
     a Gmail thread.
   - **Privacy policy URL:** required because the extension reads email content.
     Use your live Privacy page: `https://<your-domain>/privacy`.
   - **Single purpose:** describe it as "log emails to your Retrn contacts."
   - **Permission justifications:**
     - `scripting` / `activeTab` / host access to Gmail & Outlook — "to read the
       sender and subject of the email the user is currently viewing so it can be
       logged to their contact."
     - `storage` — "to keep the user signed in."
     - Supabase host — "to save the interaction to the user's own account."
   - **Data usage disclosures:** you handle personal data (email addresses,
     contact info); declare that it is used only to provide the feature and not
     sold. Google scrutinizes Gmail access, so be accurate and minimal.
5. **Submit for review.** Reviews typically take a few days to a couple of weeks.
   You can start **Unlisted** (only people with the link can install) to test
   with a small group before going Public.

### Before you submit — checklist

- [ ] Replace placeholder icons with a real 16/48/128 logo.
- [ ] Point the privacy-policy URL at your deployed `/privacy` page.
- [ ] Confirm `src/config.ts` targets your production Supabase project, set
      `RETRN_APP_URL` to your deployed app, and add that origin to
      `host_permissions` in the manifest (for SSO).
- [ ] Add 1–3 screenshots of the popup in action.
- [ ] Test the built `dist/` unpacked one more time end-to-end.
