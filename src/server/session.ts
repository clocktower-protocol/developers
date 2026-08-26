import { bytesToHex, hexToBytes } from './cryptoUtil.js';

export type AuthProvider = 'github' | 'email';

export type SessionPayload = {
  subjectId: string;
  createdAt: number;
  provider: AuthProvider;
  email?: string;
};

export const SESSION_COOKIE = 'ct_dev_session';
export const OAUTH_STATE_COOKIE = 'ct_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'ct_oauth_verifier';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const OAUTH_COOKIE_TTL_SECONDS = 60 * 10;

const PROVIDERS = new Set<AuthProvider>(['github', 'email']);

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signPayload(secret: string, payload: SessionPayload): Promise<string> {
  const body = btoa(JSON.stringify(payload));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${bytesToHex(sig)}`;
}

export async function verifyPayload(
  secret: string,
  token: string,
): Promise<SessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sigHex] = parts;
  if (!body || !sigHex || !/^[0-9a-f]+$/i.test(sigHex)) return null;

  const key = await importHmacKey(secret);
  const sigBytes = hexToBytes(sigHex);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(body),
  );
  if (!ok) return null;

  try {
    const json = JSON.parse(atob(body)) as SessionPayload;
    if (typeof json.subjectId !== 'string' || !json.subjectId.startsWith('dev_')) {
      return null;
    }
    if (typeof json.createdAt !== 'number') return null;
    if (!PROVIDERS.has(json.provider)) return null;
    if (json.email !== undefined && typeof json.email !== 'string') return null;
    return json;
  } catch {
    return null;
  }
}

export function generateSubjectId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `dev_${bytesToHex(bytes)}`;
}

export function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function cookieParts(
  name: string,
  value: string,
  opts: { secure: boolean; maxAge: number; path: string },
): string[] {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.secure) parts.push('Secure');
  return parts;
}

export function buildSessionCookie(
  value: string,
  opts: { secure: boolean; maxAge?: number } = { secure: true },
): string {
  const maxAge = opts.maxAge ?? SESSION_TTL_SECONDS;
  return cookieParts(SESSION_COOKIE, value, { secure: opts.secure, maxAge, path: '/' }).join('; ');
}

export function buildOauthCookie(
  name: string,
  value: string,
  opts: { secure: boolean; maxAge?: number } = { secure: true },
): string {
  const maxAge = opts.maxAge ?? OAUTH_COOKIE_TTL_SECONDS;
  return cookieParts(name, value, {
    secure: opts.secure,
    maxAge,
    path: '/api/auth',
  }).join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return cookieParts(SESSION_COOKIE, '', { secure, maxAge: 0, path: '/' }).join('; ');
}

export function wantsSecureCookie(request: Request, publicAppOrigin?: string): boolean {
  const origin = publicAppOrigin || '';
  if (origin.startsWith('https://')) return true;
  const host = new URL(request.url).hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

export async function getSession(
  request: Request,
  sessionSecret: string,
): Promise<SessionPayload | null> {
  const existing = parseCookieHeader(request.headers.get('Cookie'), SESSION_COOKIE);
  if (!existing) return null;
  return verifyPayload(sessionSecret, existing);
}

export async function createSessionCookieValue(
  secret: string,
  payload: SessionPayload,
  secureCookie: boolean,
): Promise<string> {
  const token = await signPayload(secret, payload);
  return buildSessionCookie(token, { secure: secureCookie });
}
