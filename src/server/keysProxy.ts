export type ApiKeyPublicMeta = {
  id: string;
  subjectId: string;
  tokenHashPrefix: string;
  label?: string;
  createdAt: number;
  revokedAt?: number;
  lastUsedAt?: number;
};

export type CreateKeyResult = {
  id: string;
  token: string;
  key: ApiKeyPublicMeta;
  warning?: string;
};

function adminHeaders(adminSecret: string): HeadersInit {
  return {
    Authorization: `Bearer ${adminSecret}`,
    'Content-Type': 'application/json',
  };
}

function apiUrl(apiBase: string, path: string): string {
  // Support both api host (no /api prefix) and workers.dev (/api prefix).
  const base = apiBase.replace(/\/$/, '');
  if (base.includes('workers.dev') || base.includes('127.0.0.1') || base.includes('localhost')) {
    return `${base}${path.startsWith('/api') ? path : `/api${path}`}`;
  }
  // Production api.clocktower.finance omits /api
  const stripped = path.replace(/^\/api/, '') || '/';
  return `${base}${stripped}`;
}

async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    const origin = new URL(url).origin;
    throw new Error(
      `Cannot reach Clocktower API at ${origin}. Start clocktower-api locally (npm run dev on :8787).`,
    );
  }
}

export async function listKeysForSubject(
  apiBase: string,
  adminSecret: string,
  subjectId: string,
): Promise<ApiKeyPublicMeta[]> {
  const url = apiUrl(
    apiBase,
    `/api/developer/keys?subjectId=${encodeURIComponent(subjectId)}`,
  );
  const res = await fetchApi(url, { headers: adminHeaders(adminSecret) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List keys failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { keys?: ApiKeyPublicMeta[] };
  return body.keys ?? [];
}

export async function createKeyForSubject(
  apiBase: string,
  adminSecret: string,
  subjectId: string,
  label?: string,
): Promise<CreateKeyResult> {
  const url = apiUrl(apiBase, '/api/developer/keys');
  const res = await fetchApi(url, {
    method: 'POST',
    headers: adminHeaders(adminSecret),
    body: JSON.stringify({
      subjectId,
      ...(label !== undefined && label.length > 0 ? { label } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Create key failed (${res.status}): ${text}`) as Error & {
      status?: number;
      body?: string;
    };
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return (await res.json()) as CreateKeyResult;
}

export async function revokeKeyForSubject(
  apiBase: string,
  adminSecret: string,
  subjectId: string,
  keyId: string,
): Promise<ApiKeyPublicMeta> {
  // Ownership check: only revoke if listed under this subject.
  const keys = await listKeysForSubject(apiBase, adminSecret, subjectId);
  const owned = keys.find((k) => k.id === keyId && !k.revokedAt);
  if (!owned) {
    const err = new Error('Key not found for this session') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const url = apiUrl(apiBase, `/api/developer/keys/${encodeURIComponent(keyId)}`);
  const res = await fetchApi(url, {
    method: 'DELETE',
    headers: adminHeaders(adminSecret),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Revoke key failed (${res.status}): ${text}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  const body = (await res.json()) as { key: ApiKeyPublicMeta };
  return body.key;
}
