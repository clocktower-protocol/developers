# clocktower-developers

Developer portal for **Clocktower REST API keys** (`ctk_…` developer tier).

Linked visually and conceptually with [clocktower-docs](https://clocktower.finance) (dark theme, Satoshi font, sky-blue accents). **MCP remains x402** — this portal only mints REST keys.

## Architecture

```
Browser (React SPA)
  → Portal BFF (this Worker)  [session cookie, no admin secret in client]
  → clocktower-api /developer/keys  [DEVELOPER_KEYS_ADMIN_SECRET server-side]
```

- **Admin secret never ships to the browser.**
- Session cookie binds a random `dev_…` subject; all create/list/revoke use that subject only.

## Features (v1)

- Create key (optional label)
- List active keys
- Reveal token **once** + copy
- Revoke key (with ownership check)

## Local development

### 1. API

Run `clocktower-api` with developer keys enabled and:

```bash
# in clocktower-api .dev.vars
DEVELOPER_KEYS_ADMIN_SECRET=<same-secret-min-32-chars>
DEVELOPER_KEYS_ENABLED=true
```

### 2. Portal

```bash
cd clocktower-developers
cp .dev.vars.example .dev.vars
# edit .dev.vars — same admin secret + CLOCKTOWER_API_BASE
npm install
npm run dev
```

- UI: http://127.0.0.1:5173 (Vite proxies `/api` → Worker :8788)
- Worker: http://127.0.0.1:8788

### 3. Try a key

Create a key in the UI, then:

```bash
curl -H "Authorization: Bearer ctk_…" \
  http://127.0.0.1:8787/api/catalog
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite + Wrangler concurrently |
| `npm test` | Vitest |
| `npm run build` | Typecheck + Vite build |
| `npm run deploy` | Build + `wrangler deploy` |

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `CLOCKTOWER_API_BASE` | Worker | API origin |
| `DEVELOPER_KEYS_ADMIN_SECRET` | Worker secret | Mint/list/revoke against API |
| `SESSION_SECRET` | Worker secret | Sign session cookies |
| `PUBLIC_APP_ORIGIN` | Worker | Cookie Secure when https |

Never use `VITE_` for secrets.

## Deploy

```bash
wrangler secret put DEVELOPER_KEYS_ADMIN_SECRET
wrangler secret put SESSION_SECRET
npm run deploy
```

Suggested host: `developers.clocktower.finance`. Add a docs navbar CTA when live.

## Security notes

- Treat admin secret as break-glass (same as API).
- Guest sessions are anonymous; API still enforces max keys + create rate limits.
- Prefer server-side use of API keys; avoid putting `ctk_` keys in public SPAs.

## Related repos

- `clocktower-api` — REST + key storage
- `clocktower-docs` — documentation site
