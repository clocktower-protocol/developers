# AGENTS.md — clocktower-developers

Developer portal for Clocktower **REST API keys**. MCP is **not** in scope (x402 only).

## Hard rules

- **Never put `DEVELOPER_KEYS_ADMIN_SECRET`, OAuth client secrets, or `SESSION_SECRET` in client code or `VITE_*` env.**
- **Never trust client-supplied `subjectId` for mint/list/revoke** — only the signed session cookie.
- Do not log API key tokens, magic-link tokens, OAuth codes, emails, or admin secrets.
- Visual tokens should stay aligned with `clocktower-docs` (dark mode, Satoshi, `--color-primary: #87CEEB`, letter-spacing 1.5px).
- Do not force-push or rewrite shared history unless asked.

## Layout

| Path | Role |
|------|------|
| `src/client/` | React SPA |
| `src/server/` | Hono BFF (OAuth/session + keys proxy) |
| `migrations/` | D1 identity/contact schema |
| `test/` | Vitest |
| `public/fonts/` | Satoshi / Univia (from docs) |

## Commands

```bash
npm test
npm run db:migrate:local
npm run dev
npm run build
npm run deploy   # ask before production
```

Local keys need **clocktower-api** on `:8787` (`CLOCKTOWER_API_BASE` in `.dev.vars`). Magic links: `EMAIL_DEV_ECHO=true` (UI shows the link). Do not set `send_email.remote: true` for day-to-day `wrangler dev` — that opens a Cloudflare tunnel and surfaces as “Network connection lost.”

`wrangler.jsonc` must keep `"run_worker_first": ["/api/*"]` so OAuth and magic-link callbacks hit the Worker, not Assets.

## API contract (upstream)

Production (`api.clocktower.finance`): `/developer/keys`. Local `wrangler dev` and `*.workers.dev`: `/api/developer/keys`. `src/server/keysProxy.ts` picks the prefix from `CLOCKTOWER_API_BASE`.

- `POST …/developer/keys` — admin secret, body `{ subjectId, label? }`
- `GET …/developer/keys?subjectId=`
- `DELETE …/developer/keys/:id`

Portal browser surface: `/api/session`, `/api/keys`, `/api/keys/:id`, `/api/auth/*` (GitHub, Google, email, logout), `/api/health`.

## Ask before

- Production deploy
- Adding more identity providers
- Putting secrets in the SPA
- Changing cookie security flags for production

## Maintenance

When upstream key API paths or admin auth change, update `src/server/keysProxy.ts` and tests in the same commit.
When OAuth callback URLs or D1 identity schema change, update `src/server/auth.ts` / `migrations/` and tests in the same commit.
When Email Service or `EMAIL_DEV_ECHO` behavior changes, update `src/server/auth.ts`, `wrangler.jsonc` `send_email`, and tests in the same commit.
