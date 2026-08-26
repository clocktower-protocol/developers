export type AuthProvider = 'github' | 'email';

export type SessionInfo =
  | { authenticated: false }
  | {
      authenticated: true;
      subjectId: string;
      createdAt: number;
      provider: AuthProvider;
      email?: string;
    };

export type ApiKeyMeta = {
  id: string;
  subjectId: string;
  tokenHashPrefix: string;
  label?: string;
  createdAt: number;
  revokedAt?: number;
  lastUsedAt?: number;
};

export type CreateKeyResponse = {
  id: string;
  token: string;
  key: ApiKeyMeta;
  warning?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    if (body.error) return new ApiError(body.error, res.status, body.code);
  } catch {
    /* ignore */
  }
  return new ApiError(`Request failed (${res.status})`, res.status);
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/session', { credentials: 'include' });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<SessionInfo>;
}

export async function fetchKeys(): Promise<{ subjectId: string; keys: ApiKeyMeta[] }> {
  const res = await fetch('/api/keys', { credentials: 'include' });
  if (res.status === 401) {
    throw new ApiError('Sign in required', 401, 'UNAUTHENTICATED');
  }
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<{ subjectId: string; keys: ApiKeyMeta[] }>;
}

export async function createKey(label?: string): Promise<CreateKeyResponse> {
  const res = await fetch('/api/keys', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(label ? { label } : {}),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<CreateKeyResponse>;
}

export async function revokeKey(id: string): Promise<void> {
  const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
}

export async function requestEmailLink(
  email: string,
): Promise<{ ok: true; devLink?: string }> {
  const res = await fetch('/api/auth/email', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<{ ok: true; devLink?: string }>;
}

export async function logout(): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw await parseError(res);
}
