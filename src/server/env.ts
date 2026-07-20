export type PortalEnv = {
  CLOCKTOWER_API_BASE: string;
  DEVELOPER_KEYS_ADMIN_SECRET: string;
  SESSION_SECRET: string;
  PUBLIC_APP_ORIGIN?: string;
  ASSETS?: Fetcher;
};

export function requireEnv(env: PortalEnv): {
  apiBase: string;
  adminSecret: string;
  sessionSecret: string;
} {
  const apiBase = (env.CLOCKTOWER_API_BASE || '').replace(/\/$/, '');
  const adminSecret = env.DEVELOPER_KEYS_ADMIN_SECRET || '';
  const sessionSecret = env.SESSION_SECRET || '';

  if (!apiBase) {
    throw new Error('CLOCKTOWER_API_BASE is not configured');
  }
  if (adminSecret.length < 16) {
    throw new Error('DEVELOPER_KEYS_ADMIN_SECRET must be at least 16 characters');
  }
  if (sessionSecret.length < 16) {
    throw new Error('SESSION_SECRET must be at least 16 characters');
  }

  return { apiBase, adminSecret, sessionSecret };
}
