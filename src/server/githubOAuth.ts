/** GitHub OAuth authorization-code flow (replaces the deprecated Arctic client). */

export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export function createGitHubAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): URL {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('state', opts.state);
  url.searchParams.set('scope', opts.scopes.join(' '));
  return url;
}

export function oauthStatesMatch(stored: string, callback: string): boolean {
  const a = new TextEncoder().encode(stored);
  const b = new TextEncoder().encode(callback);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

export async function exchangeGitHubAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<string> {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', opts.clientId);
  body.set('client_secret', opts.clientSecret);
  body.set('redirect_uri', opts.redirectUri);
  body.set('code', opts.code);

  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = (await res.json()) as { access_token?: unknown; error?: unknown };
  // GitHub often returns HTTP 200 with an error field.
  if (!res.ok || typeof json.access_token !== 'string' || !json.access_token) {
    throw new Error('GitHub token exchange failed');
  }
  return json.access_token;
}
