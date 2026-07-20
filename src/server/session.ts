export type SessionPayload = {
  subjectId: string;
  createdAt: number;
};

export const SESSION_COOKIE = 'ct_dev_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

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

export function buildSessionCookie(
  value: string,
  opts: { secure: boolean; maxAge?: number } = { secure: true },
): string {
  const maxAge = opts.maxAge ?? SESSION_TTL_SECONDS;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (opts.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export async function getOrCreateSession(
  request: Request,
  sessionSecret: string,
  secureCookie: boolean,
): Promise<{ session: SessionPayload; setCookie?: string }> {
  const existing = parseCookieHeader(request.headers.get('Cookie'), SESSION_COOKIE);
  if (existing) {
    const verified = await verifyPayload(sessionSecret, existing);
    if (verified) {
      return { session: verified };
    }
  }

  const session: SessionPayload = {
    subjectId: generateSubjectId(),
    createdAt: Date.now(),
  };
  const token = await signPayload(sessionSecret, session);
  return {
    session,
    setCookie: buildSessionCookie(token, { secure: secureCookie }),
  };
}
