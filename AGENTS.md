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

## API contract (upstream)

- `POST /developer/keys` — admin secret, body `{ subjectId, label? }`
- `GET /developer/keys?subjectId=`
- `DELETE /developer/keys/:id`

Portal browser surface: `/api/session`, `/api/keys`, `/api/keys/:id`, `/api/auth/*`, `/api/health`.

## Ask before

- Production deploy
- Adding more identity providers
- Putting secrets in the SPA
- Changing cookie security flags for production

## Maintenance

When upstream key API paths or admin auth change, update `src/server/keysProxy.ts` and tests in the same commit.
When OAuth callback URLs or D1 identity schema change, update `src/server/auth.ts` / `migrations/` and tests in the same commit.
