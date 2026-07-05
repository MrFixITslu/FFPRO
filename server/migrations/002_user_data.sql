-- Stores each user's synced app data (transactions, budgets, etc.) as a single
-- envelope-encrypted (AES-256-GCM) blob. Encrypted at the application layer
-- (see server/src/crypto.js) in addition to whatever encryption-at-rest the
-- database volume provides, so a raw DB dump/leak alone isn't enough to read it.
CREATE TABLE IF NOT EXISTS user_data (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ciphertext  BYTEA NOT NULL,
  iv          BYTEA NOT NULL,
  auth_tag    BYTEA NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
