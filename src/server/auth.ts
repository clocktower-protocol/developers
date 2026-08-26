import { Hono } from 'hono';
import { GitHub, generateState } from 'arctic';
import type { PortalEnv } from './env.js';
import {
  githubCredentials,
  publicAppOrigin,
  requireDb,
  requireSessionSecret,
} from './env.js';
import { json, redirect } from './http.js';
import { completeSignIn, d1IdentityStore, normalizeEmail, type IdentityStore } from './identity.js';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildOauthCookie,
  clearSessionCookie,
  createSessionCookieValue,
  parseCookieHeader,
  wantsSecureCookie,
  type SessionPayload,
} from './session.js';
import { randomHex, sha256Hex } from './cryptoUtil.js';

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthVariables = {
  identityStore?: IdentityStore;
};

export type AuthBindings = PortalEnv;

function storeFromEnv(env: PortalEnv, override?: IdentityStore): IdentityStore {
  if (override) return override;
  if (env.IDENTITY_STORE) return env.IDENTITY_STORE;
  return d1IdentityStore(requireDb(env));
}

function appHome(env: PortalEnv, request: Request, error?: string): string {
  const origin = publicAppOrigin(env, request);
  return error ? `${origin}/?error=${encodeURIComponent(error)}` : `${origin}/`;
}

function oauthRedirectUri(env: PortalEnv, request: Request, provider: 'github' | 'email'): string {
  return `${publicAppOrigin(env, request)}/api/auth/${provider}/callback`;
}

async function sessionCookies(
  env: PortalEnv,
  request: Request,
  payload: SessionPayload,
): Promise<string[]> {
  const secure = wantsSecureCookie(request, env.PUBLIC_APP_ORIGIN);
  const session = await createSessionCookieValue(requireSessionSecret(env), payload, secure);
  return [
    session,
    buildOauthCookie(OAUTH_STATE_COOKIE, '', { secure, maxAge: 0 }),
    buildOauthCookie(OAUTH_VERIFIER_COOKIE, '', { secure, maxAge: 0 }),
  ];
}

export async function sendMagicLinkEmail(opts: {
  email: NonNullable<PortalEnv['EMAIL']>;
  from: string;
  to: string;
  loginUrl: string;
}): Promise<void> {
  const safeUrl = opts.loginUrl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
  await opts.email.send({
    from: opts.from,
    to: opts.to,
    subject: 'Sign in to Clocktower Developers',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Sign in to Clocktower Developers</h2>
        <p>Open this link to sign in. It expires in 15 minutes.</p>
        <p><a href="${safeUrl}">${safeUrl}</a></p>
        <p style="color:#6b7280;font-size:14px;">If you did not request this, you can ignore this email.</p>
      </div>`,
  });
}

async function githubProfile(accessToken: string): Promise<{ id: string; email: string | null }> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'clocktower-developers',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) {
    throw new Error('GitHub profile request failed');
  }
  const user = (await userRes.json()) as { id: number; email?: string | null };
  let email: string | null = null;

  const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const verified = emails.filter((e) => e.verified);
    email = verified.find((e) => e.primary)?.email ?? verified[0]?.email ?? null;
  } else if (user.email) {
    email = user.email;
  }

  return { id: String(user.id), email };
}

export function createAuthApp(): Hono<{ Bindings: AuthBindings; Variables: AuthVariables }> {
  const auth = new Hono<{ Bindings: AuthBindings; Variables: AuthVariables }>();

  auth.get('/github', async (c) => {
    const creds = githubCredentials(c.env);
    if (!creds) {
      return json({ error: 'GitHub sign-in is not configured', code: 'CONFIG_ERROR' }, 503);
    }
    const state = generateState();
    const client = new GitHub(creds.clientId, creds.clientSecret, oauthRedirectUri(c.env, c.req.raw, 'github'));
    const url = client.createAuthorizationURL(state, ['read:user', 'user:email']);
    const secure = wantsSecureCookie(c.req.raw, c.env.PUBLIC_APP_ORIGIN);
    return redirect(url.toString(), [buildOauthCookie(OAUTH_STATE_COOKIE, state, { secure })]);
  });

  auth.get('/github/callback', async (c) => {
    const creds = githubCredentials(c.env);
    if (!creds) {
      return json({ error: 'GitHub sign-in is not configured', code: 'CONFIG_ERROR' }, 503);
    }
    const code = c.req.query('code');
    const state = c.req.query('state');
    const stored = parseCookieHeader(c.req.header('Cookie') ?? null, OAUTH_STATE_COOKIE);
    if (!code || !state || !stored || stored !== state) {
      return json({ error: 'Invalid OAuth state', code: 'OAUTH_STATE' }, 400);
    }
    try {
      const client = new GitHub(
        creds.clientId,
        creds.clientSecret,
        oauthRedirectUri(c.env, c.req.raw, 'github'),
      );
      const tokens = await client.validateAuthorizationCode(code);
      const profile = await githubProfile(tokens.accessToken());
      const store = storeFromEnv(c.env, c.get('identityStore'));
      const payload = await completeSignIn(store, {
        provider: 'github',
        providerUserId: profile.id,
        email: profile.email,
      });
      return redirect(appHome(c.env, c.req.raw), await sessionCookies(c.env, c.req.raw, payload));
    } catch {
      return redirect(appHome(c.env, c.req.raw, 'oauth'));
    }
  });

  auth.post('/email', async (c) => {
    let email = '';
    try {
      const body = (await c.req.json()) as { email?: unknown };
      if (typeof body.email === 'string') email = body.email;
    } catch {
      return json({ error: 'Email is required', code: 'VALIDATION_ERROR' }, 400);
    }
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized) || normalized.length > 254) {
      return json({ error: 'Enter a valid email address', code: 'VALIDATION_ERROR' }, 400);
    }

    const token = randomHex(32);
    const tokenHash = await sha256Hex(token);
    const store = storeFromEnv(c.env, c.get('identityStore'));
    await store.putMagicLink(tokenHash, normalized, Date.now() + MAGIC_LINK_TTL_MS);

    const loginUrl = `${oauthRedirectUri(c.env, c.req.raw, 'email')}?token=${encodeURIComponent(token)}`;
    const echo = c.env.EMAIL_DEV_ECHO === 'true';
    const from = c.env.EMAIL_FROM || '';

    if (!echo) {
      if (!c.env.EMAIL || !from) {
        return json({ error: 'Email sign-in is not configured', code: 'CONFIG_ERROR' }, 503);
      }
      try {
        await sendMagicLinkEmail({ email: c.env.EMAIL, from, to: normalized, loginUrl });
      } catch {
        return json({ error: 'Failed to send sign-in email', code: 'EMAIL_SEND_FAILED' }, 502);
      }
    }

    return json({
      ok: true,
      ...(echo ? { devLink: loginUrl } : {}),
    });
  });

  auth.get('/email/callback', async (c) => {
    const token = c.req.query('token');
    if (!token) {
      return redirect(appHome(c.env, c.req.raw, 'email'));
    }
    const store = storeFromEnv(c.env, c.get('identityStore'));
    const email = await store.consumeMagicLink(await sha256Hex(token), Date.now());
    if (!email) {
      return redirect(appHome(c.env, c.req.raw, 'email'));
    }
    const payload = await completeSignIn(store, {
      provider: 'email',
      providerUserId: normalizeEmail(email),
      email,
    });
    return redirect(appHome(c.env, c.req.raw), await sessionCookies(c.env, c.req.raw, payload));
  });

  auth.post('/logout', async (c) => {
    const secure = wantsSecureCookie(c.req.raw, c.env.PUBLIC_APP_ORIGIN);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', clearSessionCookie(secure));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  });

  return auth;
}

export function sessionResponse(payload: SessionPayload | null): {
  authenticated: false;
} | ({
  authenticated: true;
} & SessionPayload) {
  if (!payload) return { authenticated: false };
  return { authenticated: true, ...payload };
}
