import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/server/index';
import { memoryIdentityStore } from '../src/server/identity';
import {
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  createSessionCookieValue,
  parseCookieHeader,
  type SessionPayload,
} from '../src/server/session';
import { sha256Hex } from '../src/server/cryptoUtil';
import type { PortalEnv } from '../src/server/env';

const SECRET = 'test-session-secret-32-characters!!';

function testEnv(overrides: Partial<PortalEnv> = {}): PortalEnv {
  return {
    CLOCKTOWER_API_BASE: 'http://127.0.0.1:8787',
    DEVELOPER_KEYS_ADMIN_SECRET: 'admin-secret-at-least-16',
    SESSION_SECRET: SECRET,
    PUBLIC_APP_ORIGIN: 'http://127.0.0.1:5173',
    DB: {} as D1Database,
    IDENTITY_STORE: memoryIdentityStore(),
    ...overrides,
  };
}

const authed: SessionPayload = {
  subjectId: 'dev_abc',
  createdAt: 1,
  provider: 'email',
  email: 'dev@example.com',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('portal routes', () => {
  it('returns unauthenticated session without a cookie', async () => {
    const res = await app.request('/api/session', {}, testEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('returns 401 for key routes without a session', async () => {
    const env = testEnv();
    const getRes = await app.request('/api/keys', {}, env);
    expect(getRes.status).toBe(401);
    expect(await getRes.json()).toMatchObject({ code: 'UNAUTHENTICATED' });

    const postRes = await app.request('/api/keys', { method: 'POST' }, env);
    expect(postRes.status).toBe(401);

    const delRes = await app.request('/api/keys/key_1', { method: 'DELETE' }, env);
    expect(delRes.status).toBe(401);
  });

  it('rejects OAuth callbacks with a missing or mismatched state', async () => {
    const env = testEnv({
      GITHUB_CLIENT_ID: 'gh_id',
      GITHUB_CLIENT_SECRET: 'gh_secret',
      GOOGLE_CLIENT_ID: 'go_id',
      GOOGLE_CLIENT_SECRET: 'go_secret',
    });
    const missing = await app.request('/api/auth/github/callback?code=abc&state=x', {}, env);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: 'OAUTH_STATE' });

    const mismatched = await app.request(
      '/api/auth/github/callback?code=abc&state=nope',
      { headers: { Cookie: `${OAUTH_STATE_COOKIE}=expected` } },
      env,
    );
    expect(mismatched.status).toBe(400);

    const google = await app.request(
      '/api/auth/google/callback?code=abc&state=ok',
      { headers: { Cookie: `${OAUTH_STATE_COOKIE}=ok` } },
      env,
    );
    expect(google.status).toBe(400);
  });

  it('starts GitHub and Google OAuth with state cookies', async () => {
    const env = testEnv({
      GITHUB_CLIENT_ID: 'gh_id',
      GITHUB_CLIENT_SECRET: 'gh_secret',
      GOOGLE_CLIENT_ID: 'go_id',
      GOOGLE_CLIENT_SECRET: 'go_secret',
    });
    const gh = await app.request('/api/auth/github', {}, env);
    expect(gh.status).toBe(302);
    expect(gh.headers.get('Location')).toContain('github.com');
    expect(gh.headers.get('Set-Cookie')).toContain(OAUTH_STATE_COOKIE);

    const google = await app.request('/api/auth/google', {}, env);
    expect(google.status).toBe(302);
    expect(google.headers.get('Location')).toContain('accounts.google.com');
    const cookieHeader =
      typeof google.headers.getSetCookie === 'function'
        ? google.headers.getSetCookie().join('; ')
        : (google.headers.get('Set-Cookie') ?? '');
    expect(cookieHeader).toContain(OAUTH_STATE_COOKIE);
    expect(cookieHeader).toContain(OAUTH_VERIFIER_COOKIE);
  });

  it('issues a magic link, consumes it once, and rejects reuse', async () => {
    const store = memoryIdentityStore();
    const env = testEnv({ IDENTITY_STORE: store, EMAIL_DEV_ECHO: 'true' });
    const sent = await app.request(
      '/api/auth/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'Dev@Example.com' }),
      },
      env,
    );
    expect(sent.status).toBe(200);
    const body = (await sent.json()) as { devLink: string };
    expect(body.devLink).toContain('/api/auth/email/callback?token=');
    const token = new URL(body.devLink).searchParams.get('token');
    expect(token).toBeTruthy();

    const first = await app.request(`/api/auth/email/callback?token=${token}`, {}, env);
    expect(first.status).toBe(302);
    const setCookie = first.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain(SESSION_COOKIE);
    const cookieVal = parseCookieHeader(setCookie, SESSION_COOKIE);
    expect(cookieVal).toBeTruthy();

    const session = await app.request(
      '/api/session',
      { headers: { Cookie: `${SESSION_COOKIE}=${cookieVal}` } },
      env,
    );
    expect(await session.json()).toMatchObject({
      authenticated: true,
      provider: 'email',
      email: 'dev@example.com',
    });

    const reuse = await app.request(`/api/auth/email/callback?token=${token}`, {}, env);
    expect(reuse.status).toBe(302);
    expect(reuse.headers.get('Location')).toContain('error=email');
  });

  it('clears the session cookie on logout', async () => {
    const cookie = await createSessionCookieValue(SECRET, authed, false);
    const res = await app.request(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: { Cookie: cookie },
      },
      testEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('hashes magic-link tokens before storing', async () => {
    const store = memoryIdentityStore();
    const env = testEnv({ IDENTITY_STORE: store, EMAIL_DEV_ECHO: 'true' });
    const sent = await app.request(
      '/api/auth/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.co' }),
      },
      env,
    );
    const { devLink } = (await sent.json()) as { devLink: string };
    const token = new URL(devLink).searchParams.get('token')!;
    expect(await store.consumeMagicLink(token, Date.now())).toBeNull();
    expect(await store.consumeMagicLink(await sha256Hex(token), Date.now())).toBe('a@b.co');
  });

  it('sends magic links through the Cloudflare EMAIL binding', async () => {
    const store = memoryIdentityStore();
    const send = vi.fn(async () => ({ messageId: 'msg_1' }));
    const env = testEnv({
      IDENTITY_STORE: store,
      EMAIL_FROM: 'noreply@clocktower.finance',
      EMAIL: { send },
    });
    const res = await app.request(
      '/api/auth/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dev@example.com' }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0][0];
    expect(payload.from).toBe('noreply@clocktower.finance');
    expect(payload.to).toBe('dev@example.com');
    expect(payload.subject).toContain('Clocktower');
    expect(payload.html).toContain('/api/auth/email/callback?token=');
    expect((await res.json()) as { devLink?: string }).not.toHaveProperty('devLink');
  });
});
