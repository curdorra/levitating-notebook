# Levitating Notebook

A private, multi-user notebook. People sign up with a username and password,
keep several notebooks of rich-text pages, and choose one of three themes:
**Linen**, **Specimen** or **Reverie**. Pages autosave as you type.

Next.js 16 · Postgres (Neon) via Drizzle · Tiptap editor · Resend for reset emails.

## Run it locally

```bash
npm install
npm run preview   # fast production build — use this to look around
npm run dev       # live-reloading, for editing code (slower on first visit to each page)
```

Open http://localhost:3000. No setup is needed: without a `DATABASE_URL`, both commands
start an embedded Postgres (PGlite) that stores its data in `./.pglite`. To start
fresh, delete that folder.

Password-reset emails are printed to the terminal while `RESEND_API_KEY` is unset.

## Deploy to Vercel

1. **Push this folder to GitHub**, then import the repo at vercel.com/new.
2. **Add a database.** In the Vercel project, go to *Storage → Create → Neon*. This sets
   `DATABASE_URL` for you. You can also create a database at neon.tech and paste its
   connection string in yourself.
3. **Deploy.** The build runs `scripts/migrate.mjs` first, which creates or updates the tables.

### Optional environment variables

| Variable         | What it does                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | Sends password-reset emails. Get a key at resend.com.                                           |
| `EMAIL_FROM`     | Sender address, e.g. `Levitating Notebook <hello@yourdomain.com>`. The domain must be verified in Resend. |
| `APP_URL`        | Base URL used in reset links. It defaults to your Vercel production URL.                        |
| `LEGAL_NAME`     | Who runs the site, as named in the privacy policy and terms.                                    |
| `CONTACT_EMAIL`  | Where people send privacy requests and questions. Shown on `/privacy` and `/terms`.             |
| `LEGAL_COUNTRY`  | Where you're based; sets the governing law in the terms.                                        |

## Security and privacy

- **End-to-end encrypted.** Notebook titles, page titles and page content are encrypted in the
  browser (AES-256-GCM) before they're sent; the database only ever holds ciphertext. The key
  is derived from the password in the browser (PBKDF2, 600k rounds), and the server receives
  only a separate login key, stored bcrypt-hashed. See `src/lib/crypto.ts`.
- **Recovery key.** Shown once at sign-up. A password reset needs it to keep the notes; without
  it, a reset erases them, because nobody (including whoever runs the server) can decrypt them.
  A new one can be made in Settings.
- **Older accounts** are upgraded on their next sign-in, and their notes encrypted in the browser.
- **Rate limits** on sign-in, sign-up, resets, password checks and autosave, kept in Postgres
  (`src/lib/ratelimit.ts`). **Quotas** per account in `src/lib/limits.ts`.
- **Headers:** a nonce-based Content-Security-Policy (`src/proxy.ts`) plus nosniff, frame
  denial, referrer and permissions policies and HSTS (`next.config.ts`).
- **Your data:** Settings can export everything (decrypted in the browser) and delete the account.

## Changing the database schema

Edit `src/db/schema.ts`, then run `npm run db:generate` to write a migration into
`./drizzle/`. It's applied automatically on the next `npm run dev` or deploy.

## Where things live

| Path                          | What                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| `src/app/themes.css`          | All three themes: colour tokens, backdrops, book covers, paper              |
| `src/app/globals.css`         | Layout and components (theme-agnostic)                                      |
| `src/components/Ambience.tsx` | The animated backdrop layers                                                |
| `src/components/Editor.tsx`   | Tiptap editor and toolbar                                                   |
| `src/lib/autosave.ts`         | Debounced save, retry, and a final save when the tab closes                 |
| `src/lib/session.ts`          | Sessions: random token in an httpOnly cookie, SHA-256 hash in the database  |
| `src/app/actions/`            | Server actions for sign-up/sign-in, notebooks and account settings          |
| `src/lib/crypto.ts`           | End-to-end encryption: key derivation, wrapping, recovery key, ciphertexts  |
| `src/components/Vault.tsx`    | Holds the key in the browser; unlock, upgrade and recovery-key dialogs      |
