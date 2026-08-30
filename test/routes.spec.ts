import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/server/index';
import { memoryIdentityStore } from '../src/server/identity';
import {
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
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
  vi.unstubAllGlobals();
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
  });

  it('starts GitHub OAuth with a state cookie', async () => {
    const env = testEnv({
      GITHUB_CLIENT_ID: 'gh_id',
      GITHUB_CLIENT_SECRET: 'gh_secret',
    });
    const gh = await app.request('/api/auth/github', {}, env);
    expect(gh.status).toBe(302);
    const location = new URL(gh.headers.get('Location') ?? '');
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe('gh_id');
    expect(location.searchParams.get('scope')).toBe('read:user user:email');
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(gh.headers.get('Set-Cookie')).toContain(`${OAUTH_STATE_COOKIE}=${state}`);
  });

  it('completes GitHub OAuth and sets a session cookie', async () => {
    const env = testEnv({
      GITHUB_CLIENT_ID: 'gh_id',
      GITHUB_CLIENT_SECRET: 'gh_secret',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes('/login/oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'gho_test' }), { status: 200 });
        }
        if (url.includes('api.github.com/user/emails')) {
          return new Response(
            JSON.stringify([{ email: 'gh@example.com', primary: true, verified: true }]),
            { status: 200 },
          );
        }
        if (url.includes('api.github.com/user')) {
          return new Response(JSON.stringify({ id: 42, email: null }), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const res = await app.request(
      '/api/auth/github/callback?code=abc&state=expected',
      { headers: { Cookie: `${OAUTH_STATE_COOKIE}=expected` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('http://127.0.0.1:5173/');
    expect(res.headers.get('Set-Cookie')).toContain(SESSION_COOKIE);
  });

  it('does not expose Google OAuth routes', async () => {
    const res = await app.request('/api/auth/google', {}, testEnv());
    expect(res.status).toBe(404);
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
