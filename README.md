# clocktower-developers

Developer portal for **Clocktower REST API and MCP keys** (`ctk_…` developer tier).

Linked visually and conceptually with [clocktower-docs](https://clocktower.finance) (dark theme, Satoshi font, sky-blue accents). Keys use the same developer limits on REST and MCP (no x402).

Sign-in is **GitHub or a passwordless email magic link**. There are no guest sessions and no passwords.

## Architecture

```
Browser (React SPA)
  → Portal BFF (this Worker)  [OAuth + HMAC session cookie, no admin secret in client]
  → D1 (users / identities / magic links)
  → clocktower-api /developer/keys  [DEVELOPER_KEYS_ADMIN_SECRET server-side]
```

- **Admin secret and OAuth client secrets never ship to the browser.**
- After sign-in, the session cookie binds a stable `dev_…` subject; all create/list/revoke use that subject only.
- Verified emails are stored in D1 for account linking and operator outreach (`wrangler d1 execute`). There is no public email-export API.

## Features

- Sign in with GitHub or email magic link
- Create key (optional label)
- List active keys
- Reveal token **once** + copy
- Revoke key (with ownership check)
- Sign out

## Local development

### 1. API

The portal proxies mint/list/revoke to **local** `clocktower-api` (`CLOCKTOWER_API_BASE=http://127.0.0.1:8787` in `.dev.vars`).

In a second terminal:

```bash
cd clocktower-api
# .dev.vars must include:
# DEVELOPER_KEYS_ADMIN_SECRET=<same-secret-min-32-chars>
# DEVELOPER_KEYS_ENABLED=true
npm run dev
```

If the API is not running, the dashboard shows that it cannot reach `:8787` (workerd otherwise reports “Network connection lost”).

### 2. Portal

```bash
cd clocktower-developers
cp .dev.vars.example .dev.vars
# edit .dev.vars — same admin secret, CLOCKTOWER_API_BASE, GitHub OAuth, EMAIL_DEV_ECHO=true
npm install
npm run db:migrate:local
npm run dev
```

- UI: http://127.0.0.1:5173 (Vite proxies `/api` → Worker :8788)
- Worker: http://127.0.0.1:8788
- Local D1 is SQLite via `npm run db:migrate:local` (once, or after pulling new migrations). Production D1 is separate and already bound in `wrangler.jsonc`.

OAuth callback URL for local GitHub apps:

- `http://127.0.0.1:5173/api/auth/github/callback`

With `EMAIL_DEV_ECHO=true`, the UI shows the magic link so you can sign in without sending mail. Local `wrangler dev` simulates the `EMAIL` binding (no Cloudflare tunnel). Production uses Cloudflare Email Service, same as clocktower-caller.

### 3. Try a key

Sign in, create a key in the UI, then:

```bash
curl -H "Authorization: Bearer ctk_…" \
  http://127.0.0.1:8787/api/catalog
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite + Wrangler concurrently |
| `npm test` | Vitest |
| `npm run db:migrate:local` | Apply D1 migrations to local SQLite |
| `npm run build` | Typecheck + Vite build |
| `npm run deploy` | Build + `wrangler deploy` |

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `CLOCKTOWER_API_BASE` | Worker var | API origin (`wrangler.jsonc`) |
| `DEVELOPER_KEYS_ADMIN_SECRET` | Worker secret | Mint/list/revoke against API |
| `SESSION_SECRET` | Worker secret | Sign session cookies |
| `PUBLIC_APP_ORIGIN` | Worker var | Cookie Secure when https; OAuth redirect origin |
| `GITHUB_CLIENT_ID` | Worker var | GitHub OAuth app id |
| `GITHUB_CLIENT_SECRET` | Worker secret | GitHub OAuth app secret |
| `EMAIL` | `send_email` binding | Cloudflare Email Service (same as clocktower-caller) |
| `EMAIL_FROM` | Worker var | Verified sender on the onboarded domain |
| `EMAIL_DEV_ECHO` | Worker (local only) | `true` returns the magic link in JSON |
| `DB` | D1 binding | Users, identities, magic links |

Never use `VITE_` for secrets.

## Deploy

Production D1 (`clocktower-developers`) is already bound in `wrangler.jsonc`. Do not run `wrangler d1 create` again unless you intend to make a new database.

```bash
npx wrangler d1 migrations apply clocktower-developers --remote
npx wrangler secret put DEVELOPER_KEYS_ADMIN_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Set `GITHUB_CLIENT_ID` as a plaintext Worker variable (dashboard **Variables and Secrets**, or a `vars` entry in `wrangler.jsonc` — not `VITE_`). `npx wrangler deploy` (and Workers Builds) apply any pending D1 migrations. Leave `send_email` without `remote: true`; production binds Email Service directly.

Workers Builds (Git):

| Setting | Command |
|---------|---------|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

Onboard the sending domain under Cloudflare Dashboard → **Email Sending** (Workers Paid), then set `EMAIL_FROM` to a verified address on that domain. There is no third-party email API key.

Host: `developers.clocktower.finance`. Production GitHub OAuth apps must allow:

- `https://developers.clocktower.finance/api/auth/github/callback`

## Breaking change

Anonymous guest cookies (`dev_…` minted on first visit) are gone. Keys created under a guest session cannot be reattached after sign-in.

## Security notes

- Treat admin secret as break-glass (same as API).
- Prefer server-side use of API keys; avoid putting `ctk_` keys in public SPAs.
- Do not log emails, magic-link tokens, or OAuth codes.
- Contact list: query D1 (`SELECT subject_id, email, last_login_at FROM users WHERE email IS NOT NULL`).

## Related repos

- `clocktower-api` — REST + key storage
- `clocktower-docs` — documentation site
