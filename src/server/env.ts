export type PortalEnv = {
  CLOCKTOWER_API_BASE: string;
  DEVELOPER_KEYS_ADMIN_SECRET: string;
  SESSION_SECRET: string;
  PUBLIC_APP_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_DEV_ECHO?: string;
  DB: D1Database;
  ASSETS?: Fetcher;
  /** Test-only identity store; production uses D1 `DB`. */
  IDENTITY_STORE?: import('./identity.js').IdentityStore;
};

export function requireSessionSecret(env: PortalEnv): string {
  const sessionSecret = env.SESSION_SECRET || '';
  if (sessionSecret.length < 16) {
    throw new Error('SESSION_SECRET must be at least 16 characters');
  }
  return sessionSecret;
}

export function requireDb(env: PortalEnv): D1Database {
  if (!env.DB) {
    throw new Error('D1 database binding DB is not configured');
  }
  return env.DB;
}

export function requireKeysEnv(env: PortalEnv): {
  apiBase: string;
  adminSecret: string;
  sessionSecret: string;
} {
  const apiBase = (env.CLOCKTOWER_API_BASE || '').replace(/\/$/, '');
  const adminSecret = env.DEVELOPER_KEYS_ADMIN_SECRET || '';
  const sessionSecret = requireSessionSecret(env);

  if (!apiBase) {
    throw new Error('CLOCKTOWER_API_BASE is not configured');
  }
  if (adminSecret.length < 16) {
    throw new Error('DEVELOPER_KEYS_ADMIN_SECRET must be at least 16 characters');
  }

  return { apiBase, adminSecret, sessionSecret };
}

/** @deprecated use requireKeysEnv / requireSessionSecret */
export function requireEnv(env: PortalEnv): {
  apiBase: string;
  adminSecret: string;
  sessionSecret: string;
} {
  return requireKeysEnv(env);
}

export function publicAppOrigin(env: PortalEnv, request: Request): string {
  if (env.PUBLIC_APP_ORIGIN) return env.PUBLIC_APP_ORIGIN.replace(/\/$/, '');
  return new URL(request.url).origin;
}

export function githubCredentials(env: PortalEnv): { clientId: string; clientSecret: string } | null {
  const clientId = env.GITHUB_CLIENT_ID || '';
  const clientSecret = env.GITHUB_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleCredentials(env: PortalEnv): { clientId: string; clientSecret: string } | null {
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
