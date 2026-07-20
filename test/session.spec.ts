import { describe, expect, it } from 'vitest';
import {
  generateSubjectId,
  getOrCreateSession,
  signPayload,
  verifyPayload,
  parseCookieHeader,
  SESSION_COOKIE,
} from '../src/server/session';

const SECRET = 'test-session-secret-32-characters!!';

describe('session', () => {
  it('generates dev_ subject ids', () => {
    const id = generateSubjectId();
    expect(id.startsWith('dev_')).toBe(true);
    expect(id.length).toBeGreaterThan(20);
  });

  it('signs and verifies payloads', async () => {
    const payload = { subjectId: 'dev_abc', createdAt: 123 };
    const token = await signPayload(SECRET, payload);
    const verified = await verifyPayload(SECRET, token);
    expect(verified).toEqual(payload);
  });

  it('rejects tampered signatures', async () => {
    const token = await signPayload(SECRET, {
      subjectId: 'dev_abc',
      createdAt: 1,
    });
    const [body] = token.split('.');
    const bad = `${body}.${'00'.repeat(32)}`;
    expect(await verifyPayload(SECRET, bad)).toBeNull();
  });

  it('creates a session cookie when missing', async () => {
    const req = new Request('http://localhost/api/session');
    const { session, setCookie } = await getOrCreateSession(req, SECRET, false);
    expect(session.subjectId.startsWith('dev_')).toBe(true);
    expect(setCookie).toContain(SESSION_COOKIE);
    expect(setCookie).toContain('HttpOnly');
  });

  it('reuses valid session cookie', async () => {
    const first = await getOrCreateSession(
      new Request('http://localhost/api/session'),
      SECRET,
      false,
    );
    const cookieVal = parseCookieHeader(first.setCookie ?? null, SESSION_COOKIE);
    expect(cookieVal).toBeTruthy();
    const second = await getOrCreateSession(
      new Request('http://localhost/api/session', {
        headers: { Cookie: `${SESSION_COOKIE}=${cookieVal}` },
      }),
      SECRET,
      false,
    );
    expect(second.session.subjectId).toBe(first.session.subjectId);
    expect(second.setCookie).toBeUndefined();
  });
});
