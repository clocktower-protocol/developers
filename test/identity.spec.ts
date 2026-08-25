import { describe, expect, it } from 'vitest';
import {
  completeSignIn,
  memoryIdentityStore,
  normalizeEmail,
} from '../src/server/identity';
import { sha256Hex } from '../src/server/cryptoUtil';

describe('identity', () => {
  it('creates a new subject on first GitHub login', async () => {
    const store = memoryIdentityStore();
    const session = await completeSignIn(store, {
      provider: 'github',
      providerUserId: '42',
      email: 'Ada@Example.com',
    });
    expect(session.subjectId.startsWith('dev_')).toBe(true);
    expect(session.provider).toBe('github');
    expect(session.email).toBe('Ada@Example.com');
    const user = await store.getUser(session.subjectId);
    expect(user?.emailNormalized).toBe('ada@example.com');
  });

  it('reuses subjectId for the same GitHub account', async () => {
    const store = memoryIdentityStore();
    const first = await completeSignIn(store, {
      provider: 'github',
      providerUserId: '42',
      email: 'a@example.com',
    });
    const second = await completeSignIn(
      store,
      { provider: 'github', providerUserId: '42', email: 'a@example.com' },
      first.createdAt + 1000,
    );
    expect(second.subjectId).toBe(first.subjectId);
    const user = await store.getUser(first.subjectId);
    expect(user?.lastLoginAt).toBe(first.createdAt + 1000);
  });

  it('links Google to an existing verified email', async () => {
    const store = memoryIdentityStore();
    const github = await completeSignIn(store, {
      provider: 'github',
      providerUserId: '1',
      email: 'dev@clocktower.finance',
    });
    const google = await completeSignIn(store, {
      provider: 'google',
      providerUserId: 'sub_9',
      email: 'dev@clocktower.finance',
    });
    expect(google.subjectId).toBe(github.subjectId);
  });

  it('keeps users without verified email as a new subject', async () => {
    const store = memoryIdentityStore();
    const a = await completeSignIn(store, {
      provider: 'github',
      providerUserId: '1',
      email: null,
    });
    const b = await completeSignIn(store, {
      provider: 'github',
      providerUserId: '2',
      email: null,
    });
    expect(b.subjectId).not.toBe(a.subjectId);
    expect(a.email).toBeUndefined();
  });

  it('consumes a magic link once and rejects reuse or expiry', async () => {
    const store = memoryIdentityStore();
    const hash = await sha256Hex('secret-token');
    await store.putMagicLink(hash, 'user@example.com', Date.now() + 60_000);
    expect(await store.consumeMagicLink(hash, Date.now())).toBe('user@example.com');
    expect(await store.consumeMagicLink(hash, Date.now())).toBeNull();

    const expiredHash = await sha256Hex('expired-token');
    await store.putMagicLink(expiredHash, 'user@example.com', Date.now() - 1);
    expect(await store.consumeMagicLink(expiredHash, Date.now())).toBeNull();
  });

  it('normalizes emails for linking', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
});
