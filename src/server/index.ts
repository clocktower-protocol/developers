import { Hono } from 'hono';
import { requireKeysEnv, requireSessionSecret, type PortalEnv } from './env.js';
import { json } from './http.js';
import { createAuthApp, sessionResponse } from './auth.js';
import { getSession, wantsSecureCookie } from './session.js';
import type { IdentityStore } from './identity.js';
import {
  createKeyForSubject,
  listKeysForSubject,
  revokeKeyForSubject,
} from './keysProxy.js';

type Variables = {
  subjectId: string;
  identityStore?: IdentityStore;
};

const app = new Hono<{ Bindings: PortalEnv; Variables: Variables }>();

app.get('/api/health', (c) => json({ status: 'ok', service: 'clocktower-developers' }));

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('D1_ERROR') || message.includes('no such table')) {
    return json({ error: 'Identity database is not migrated', code: 'DB_ERROR' }, 500);
  }
  return json({ error: 'Internal error', code: 'INTERNAL_ERROR' }, 500);
});

app.route('/api/auth', createAuthApp());

app.get('/api/session', async (c) => {
  try {
    const sessionSecret = requireSessionSecret(c.env);
    const session = await getSession(c.req.raw, sessionSecret);
    return json(sessionResponse(session));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message, code: 'CONFIG_ERROR' }, 500);
  }
});

app.use('/api/keys', async (c, next) => {
  try {
    const sessionSecret = requireSessionSecret(c.env);
    const session = await getSession(c.req.raw, sessionSecret);
    if (!session) {
      return json({ error: 'Sign in required', code: 'UNAUTHENTICATED' }, 401);
    }
    c.set('subjectId', session.subjectId);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message, code: 'CONFIG_ERROR' }, 500);
  }
});

app.use('/api/keys/*', async (c, next) => {
  try {
    const sessionSecret = requireSessionSecret(c.env);
    const session = await getSession(c.req.raw, sessionSecret);
    if (!session) {
      return json({ error: 'Sign in required', code: 'UNAUTHENTICATED' }, 401);
    }
    c.set('subjectId', session.subjectId);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message, code: 'CONFIG_ERROR' }, 500);
  }
});

app.get('/api/keys', async (c) => {
  try {
    const { apiBase, adminSecret } = requireKeysEnv(c.env);
    const subjectId = c.get('subjectId');
    const keys = await listKeysForSubject(apiBase, adminSecret, subjectId);
    return json({
      subjectId,
      keys: keys.filter((k) => !k.revokedAt),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message, code: 'UPSTREAM_ERROR' }, 502);
  }
});

app.post('/api/keys', async (c) => {
  try {
    const { apiBase, adminSecret } = requireKeysEnv(c.env);
    const subjectId = c.get('subjectId');
    let label: string | undefined;
    try {
      const body = await c.req.json();
      if (body && typeof body === 'object' && typeof (body as { label?: unknown }).label === 'string') {
        label = (body as { label: string }).label;
      }
    } catch {
      // empty body ok
    }
    // Never trust client subjectId — only session.
    const result = await createKeyForSubject(apiBase, adminSecret, subjectId, label);
    return json(result, 201);
  } catch (err) {
    const e = err as Error & { status?: number; body?: string };
    const status = e.status === 409 ? 409 : e.status === 429 ? 429 : 502;
    let code = 'UPSTREAM_ERROR';
    if (e.status === 409) code = 'MAX_KEYS';
    if (e.status === 429) code = 'RATE_LIMITED';
    return json({ error: e.message, code }, status);
  }
});

app.delete('/api/keys/:id', async (c) => {
  try {
    const { apiBase, adminSecret } = requireKeysEnv(c.env);
    const subjectId = c.get('subjectId');
    const id = c.req.param('id');
    if (!id.startsWith('key_')) {
      return json({ error: 'Invalid key id', code: 'VALIDATION_ERROR' }, 400);
    }
    const key = await revokeKeyForSubject(apiBase, adminSecret, subjectId, id);
    return json({ key, revoked: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status === 404 ? 404 : 502;
    return json(
      { error: e.message, code: status === 404 ? 'NOT_FOUND' : 'UPSTREAM_ERROR' },
      status,
    );
  }
});

export default {
  async fetch(request: Request, env: PortalEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

export { app };
export { wantsSecureCookie };
