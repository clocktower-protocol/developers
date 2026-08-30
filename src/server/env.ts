export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR';
}

function readWorkerString(env: PortalEnv, key: 'SESSION_SECRET' | 'DEVELOPER_KEYS_ADMIN_SECRET' | 'CLOCKTOWER_API_BASE'): string {
  const fromEnv = env[key];
  if (typeof fromEnv === 'string') return fromEnv.trim();
  const fromProcess =
    typeof process !== 'undefined' ? process.env[key] : undefined;
  if (typeof fromProcess === 'string') return fromProcess.trim();
  return '';
}

export type PortalEnv = {
  CLOCKTOWER_API_BASE: string;
  DEVELOPER_KEYS_ADMIN_SECRET: string;
  SESSION_SECRET: string;
  PUBLIC_APP_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  EMAIL_FROM?: string;
  EMAIL_DEV_ECHO?: string;
  /** Cloudflare Email Service binding (`send_email` name EMAIL), same as clocktower-caller. */
  EMAIL?: {
    send(message: {
      from: string;
      to: string;
      subject: string;
      html: string;
    }): Promise<{ messageId?: string } | void>;
  };
  DB: D1Database;
  ASSETS?: Fetcher;
  /** Test-only identity store; production uses D1 `DB`. */
  IDENTITY_STORE?: import('./identity.js').IdentityStore;
};

export function requireSessionSecret(env: PortalEnv): string {
  const sessionSecret = readWorkerString(env, 'SESSION_SECRET');
  if (!sessionSecret) {
    throw new ConfigError('SESSION_SECRET is not configured on this Worker');
  }
  if (sessionSecret.length < 16) {
    throw new ConfigError('SESSION_SECRET must be at least 16 characters');
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
  const apiBase = readWorkerString(env, 'CLOCKTOWER_API_BASE').replace(/\/$/, '');
  const adminSecret = readWorkerString(env, 'DEVELOPER_KEYS_ADMIN_SECRET');
  const sessionSecret = requireSessionSecret(env);

  if (!apiBase) {
    throw new ConfigError('CLOCKTOWER_API_BASE is not configured');
  }
  if (!adminSecret) {
    throw new ConfigError(
      'DEVELOPER_KEYS_ADMIN_SECRET is not bound on this Worker. Add it under Settings → Variables and Secrets, then Deploy.',
    );
  }
  if (adminSecret.length < 16) {
    throw new ConfigError('DEVELOPER_KEYS_ADMIN_SECRET must be at least 16 characters');
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
