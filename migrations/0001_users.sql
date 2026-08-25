CREATE TABLE users (
  subject_id TEXT PRIMARY KEY,
  email TEXT,
  email_normalized TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE identities (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES users(subject_id),
  email TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE INDEX idx_identities_subject ON identities(subject_id);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
