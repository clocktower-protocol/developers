import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GITHUB_AUTHORIZE_URL,
  GITHUB_TOKEN_URL,
  createGitHubAuthorizeUrl,
  exchangeGitHubAccessToken,
  oauthStatesMatch,
} from '../src/server/githubOAuth';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('githubOAuth', () => {
  it('builds a GitHub authorize URL with state and scopes', () => {
    const url = createGitHubAuthorizeUrl({
      clientId: 'gh_id',
      redirectUri: 'http://127.0.0.1:5173/api/auth/github/callback',
      state: 'abc123',
      scopes: ['read:user', 'user:email'],
    });
    expect(url.origin + url.pathname).toBe(GITHUB_AUTHORIZE_URL);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('gh_id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://127.0.0.1:5173/api/auth/github/callback',
    );
    expect(url.searchParams.get('state')).toBe('abc123');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
  });

  it('compares OAuth state in constant time', () => {
    expect(oauthStatesMatch('same', 'same')).toBe(true);
    expect(oauthStatesMatch('same', 'diff')).toBe(false);
    expect(oauthStatesMatch('short', 'longer')).toBe(false);
  });

  it('exchanges a code for an access token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      expect(String(input)).toBe(GITHUB_TOKEN_URL);
      expect(init?.method).toBe('POST');
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('client_id')).toBe('gh_id');
      expect(body.get('client_secret')).toBe('gh_secret');
      expect(body.get('code')).toBe('abc');
      expect(body.get('redirect_uri')).toBe('http://127.0.0.1:5173/api/auth/github/callback');
      return new Response(JSON.stringify({ access_token: 'gho_test' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      exchangeGitHubAccessToken({
        clientId: 'gh_id',
        clientSecret: 'gh_secret',
        redirectUri: 'http://127.0.0.1:5173/api/auth/github/callback',
        code: 'abc',
      }),
    ).resolves.toBe('gho_test');
  });

  it('rejects GitHub error payloads even when HTTP status is 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 200 })),
    );

    await expect(
      exchangeGitHubAccessToken({
        clientId: 'gh_id',
        clientSecret: 'gh_secret',
        redirectUri: 'http://127.0.0.1:5173/api/auth/github/callback',
        code: 'abc',
      }),
    ).rejects.toThrow('GitHub token exchange failed');
  });
});
