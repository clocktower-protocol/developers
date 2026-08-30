import { describe, expect, it } from 'vitest';
import { ConfigError, requireKeysEnv, type PortalEnv } from '../src/server/env';

function baseEnv(overrides: Partial<PortalEnv> = {}): PortalEnv {
  return {
    CLOCKTOWER_API_BASE: 'https://api.clocktower.finance',
    DEVELOPER_KEYS_ADMIN_SECRET: 'admin-secret-at-least-16',
    SESSION_SECRET: 'test-session-secret-32-characters!!',
    DB: {} as D1Database,
    ...overrides,
  };
}

describe('requireKeysEnv', () => {
  it('accepts a 16+ character admin secret', () => {
    expect(requireKeysEnv(baseEnv()).adminSecret).toBe('admin-secret-at-least-16');
  });

  it('says the admin secret is unbound when missing, not that it is too short', () => {
    expect(() => requireKeysEnv(baseEnv({ DEVELOPER_KEYS_ADMIN_SECRET: '' }))).toThrow(ConfigError);
    expect(() => requireKeysEnv(baseEnv({ DEVELOPER_KEYS_ADMIN_SECRET: '' }))).toThrow(
      /not bound on this Worker/,
    );
  });

  it('rejects an admin secret that is present but shorter than 16 characters', () => {
    expect(() => requireKeysEnv(baseEnv({ DEVELOPER_KEYS_ADMIN_SECRET: 'short' }))).toThrow(
      /must be at least 16 characters/,
    );
  });
});
