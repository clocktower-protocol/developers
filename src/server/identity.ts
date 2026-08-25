import { generateSubjectId, type AuthProvider, type SessionPayload } from './session.js';

export type UserRow = {
  subjectId: string;
  email: string | null;
  emailNormalized: string | null;
  createdAt: number;
  lastLoginAt: number;
};

export type IdentityStore = {
  findIdentity(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<{ subjectId: string } | null>;
  findUserByNormalizedEmail(emailNormalized: string): Promise<UserRow | null>;
  getUser(subjectId: string): Promise<UserRow | null>;
  insertUser(user: UserRow): Promise<void>;
  updateUserOnLogin(subjectId: string, email: string | null, now: number): Promise<void>;
  insertIdentity(row: {
    provider: AuthProvider;
    providerUserId: string;
    subjectId: string;
    email: string | null;
    createdAt: number;
  }): Promise<void>;
  putMagicLink(tokenHash: string, email: string, expiresAt: number): Promise<void>;
  consumeMagicLink(tokenHash: string, now: number): Promise<string | null>;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapUser(row: {
  subject_id: string;
  email: string | null;
  email_normalized: string | null;
  created_at: number;
  last_login_at: number;
}): UserRow {
  return {
    subjectId: row.subject_id,
    email: row.email,
    emailNormalized: row.email_normalized,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function d1IdentityStore(db: D1Database): IdentityStore {
  return {
    async findIdentity(provider, providerUserId) {
      const row = await db
        .prepare(
          'SELECT subject_id FROM identities WHERE provider = ? AND provider_user_id = ?',
        )
        .bind(provider, providerUserId)
        .first<{ subject_id: string }>();
      return row ? { subjectId: row.subject_id } : null;
    },

    async findUserByNormalizedEmail(emailNormalized) {
      const row = await db
        .prepare(
          'SELECT subject_id, email, email_normalized, created_at, last_login_at FROM users WHERE email_normalized = ?',
        )
        .bind(emailNormalized)
        .first<{
          subject_id: string;
          email: string | null;
          email_normalized: string | null;
          created_at: number;
          last_login_at: number;
        }>();
      return row ? mapUser(row) : null;
    },

    async getUser(subjectId) {
      const row = await db
        .prepare(
          'SELECT subject_id, email, email_normalized, created_at, last_login_at FROM users WHERE subject_id = ?',
        )
        .bind(subjectId)
        .first<{
          subject_id: string;
          email: string | null;
          email_normalized: string | null;
          created_at: number;
          last_login_at: number;
        }>();
      return row ? mapUser(row) : null;
    },

    async insertUser(user) {
      await db
        .prepare(
          'INSERT INTO users (subject_id, email, email_normalized, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          user.subjectId,
          user.email,
          user.emailNormalized,
          user.createdAt,
          user.lastLoginAt,
        )
        .run();
    },

    async updateUserOnLogin(subjectId, email, now) {
      const normalized = email ? normalizeEmail(email) : null;
      await db
        .prepare(
          `UPDATE users SET
            last_login_at = ?,
            email = CASE WHEN email IS NULL AND ? IS NOT NULL THEN ? ELSE email END,
            email_normalized = CASE WHEN email_normalized IS NULL AND ? IS NOT NULL THEN ? ELSE email_normalized END
          WHERE subject_id = ?`,
        )
        .bind(now, email, email, normalized, normalized, subjectId)
        .run();
    },

    async insertIdentity(row) {
      await db
        .prepare(
          'INSERT INTO identities (provider, provider_user_id, subject_id, email, created_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(row.provider, row.providerUserId, row.subjectId, row.email, row.createdAt)
        .run();
    },

    async putMagicLink(tokenHash, email, expiresAt) {
      await db
        .prepare('INSERT INTO magic_links (token_hash, email, expires_at) VALUES (?, ?, ?)')
        .bind(tokenHash, email, expiresAt)
        .run();
    },

    async consumeMagicLink(tokenHash, now) {
      const row = await db
        .prepare('SELECT email, expires_at FROM magic_links WHERE token_hash = ?')
        .bind(tokenHash)
        .first<{ email: string; expires_at: number }>();
      if (!row) return null;
      await db.prepare('DELETE FROM magic_links WHERE token_hash = ?').bind(tokenHash).run();
      if (row.expires_at < now) return null;
      return row.email;
    },
  };
}

export function memoryIdentityStore(): IdentityStore {
  const users = new Map<string, UserRow>();
  const identities = new Map<string, { subjectId: string; email: string | null; createdAt: number }>();
  const emails = new Map<string, string>();
  const magic = new Map<string, { email: string; expiresAt: number }>();

  const idKey = (provider: AuthProvider, providerUserId: string) =>
    `${provider}:${providerUserId}`;

  return {
    async findIdentity(provider, providerUserId) {
      const row = identities.get(idKey(provider, providerUserId));
      return row ? { subjectId: row.subjectId } : null;
    },
    async findUserByNormalizedEmail(emailNormalized) {
      const subjectId = emails.get(emailNormalized);
      return subjectId ? (users.get(subjectId) ?? null) : null;
    },
    async getUser(subjectId) {
      return users.get(subjectId) ?? null;
    },
    async insertUser(user) {
      users.set(user.subjectId, { ...user });
      if (user.emailNormalized) emails.set(user.emailNormalized, user.subjectId);
    },
    async updateUserOnLogin(subjectId, email, now) {
      const user = users.get(subjectId);
      if (!user) return;
      const next: UserRow = { ...user, lastLoginAt: now };
      if (!next.email && email) {
        next.email = email;
        next.emailNormalized = normalizeEmail(email);
        emails.set(next.emailNormalized, subjectId);
      }
      users.set(subjectId, next);
    },
    async insertIdentity(row) {
      identities.set(idKey(row.provider, row.providerUserId), {
        subjectId: row.subjectId,
        email: row.email,
        createdAt: row.createdAt,
      });
    },
    async putMagicLink(tokenHash, email, expiresAt) {
      magic.set(tokenHash, { email, expiresAt });
    },
    async consumeMagicLink(tokenHash, now) {
      const row = magic.get(tokenHash);
      if (!row) return null;
      magic.delete(tokenHash);
      if (row.expiresAt < now) return null;
      return row.email;
    },
  };
}

export async function completeSignIn(
  store: IdentityStore,
  input: {
    provider: AuthProvider;
    providerUserId: string;
    email: string | null;
  },
  now = Date.now(),
): Promise<SessionPayload> {
  const email = input.email ? input.email.trim() : null;
  const emailNormalized = email ? normalizeEmail(email) : null;

  const existingIdentity = await store.findIdentity(input.provider, input.providerUserId);
  let subjectId = existingIdentity?.subjectId ?? null;

  if (!subjectId && emailNormalized) {
    const linked = await store.findUserByNormalizedEmail(emailNormalized);
    subjectId = linked?.subjectId ?? null;
  }

  if (!subjectId) {
    subjectId = generateSubjectId();
    await store.insertUser({
      subjectId,
      email,
      emailNormalized,
      createdAt: now,
      lastLoginAt: now,
    });
  } else {
    await store.updateUserOnLogin(subjectId, email, now);
  }

  if (!existingIdentity) {
    await store.insertIdentity({
      provider: input.provider,
      providerUserId: input.providerUserId,
      subjectId,
      email,
      createdAt: now,
    });
  }

  const user = await store.getUser(subjectId);
  return {
    subjectId,
    createdAt: user?.createdAt ?? now,
    provider: input.provider,
    ...(user?.email ? { email: user.email } : email ? { email } : {}),
  };
}
