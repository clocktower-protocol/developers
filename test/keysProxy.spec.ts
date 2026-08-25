import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createKeyForSubject,
  listKeysForSubject,
  revokeKeyForSubject,
} from '../src/server/keysProxy';

const API = 'http://127.0.0.1:8787';
const SECRET = 'admin-secret-at-least-16-chars';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('keysProxy', () => {
  it('maps fetch failures to a local API hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network connection lost');
      }),
    );

    await expect(listKeysForSubject(API, SECRET, 'dev_1')).rejects.toThrow(
      /Cannot reach Clocktower API at http:\/\/127\.0\.0\.1:8787/,
    );
  });

  it('lists keys with admin Authorization header', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      expect(String(input)).toContain('/api/developer/keys?subjectId=dev_1');
      return new Response(
        JSON.stringify({
          keys: [
            {
              id: 'key_1',
              subjectId: 'dev_1',
              tokenHashPrefix: 'abcd1234',
              createdAt: 1,
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const keys = await listKeysForSubject(API, SECRET, 'dev_1');
    expect(keys).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${SECRET}`,
    );
  });

  it('creates key with server subjectId only', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.subjectId).toBe('dev_server');
      expect(body.label).toBe('lab');
      return new Response(
        JSON.stringify({
          id: 'key_x',
          token: 'ctk_secret',
          key: {
            id: 'key_x',
            subjectId: 'dev_server',
            tokenHashPrefix: 'ff',
            createdAt: 2,
          },
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createKeyForSubject(API, SECRET, 'dev_server', 'lab');
    expect(result.token).toBe('ctk_secret');
  });

  it('refuses revoke when key not owned by subject', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ keys: [] }), { status: 200 }),
      ),
    );

    await expect(
      revokeKeyForSubject(API, SECRET, 'dev_1', 'key_other'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('revokes after ownership check', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('subjectId=')) {
        return new Response(
          JSON.stringify({
            keys: [
              {
                id: 'key_1',
                subjectId: 'dev_1',
                tokenHashPrefix: 'aa',
                createdAt: 1,
              },
            ],
          }),
          { status: 200 },
        );
      }
      expect(init?.method).toBe('DELETE');
      expect(url).toContain('/api/developer/keys/key_1');
      return new Response(
        JSON.stringify({
          key: {
            id: 'key_1',
            subjectId: 'dev_1',
            tokenHashPrefix: 'aa',
            createdAt: 1,
            revokedAt: 9,
          },
          revoked: true,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const key = await revokeKeyForSubject(API, SECRET, 'dev_1', 'key_1');
    expect(key.revokedAt).toBe(9);
  });
});
