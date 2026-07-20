export type SessionInfo = {
  subjectId: string;
  createdAt: number;
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

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    if (body.error) return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/session', { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<SessionInfo>;
}

export async function fetchKeys(): Promise<{ subjectId: string; keys: ApiKeyMeta[] }> {
  const res = await fetch('/api/keys', { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ subjectId: string; keys: ApiKeyMeta[] }>;
}

export async function createKey(label?: string): Promise<CreateKeyResponse> {
  const res = await fetch('/api/keys', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(label ? { label } : {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<CreateKeyResponse>;
}

export async function revokeKey(id: string): Promise<void> {
  const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res));
}
