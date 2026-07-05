-- Core auth schema for FFPRO.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  username       TEXT UNIQUE,
  password_hash  TEXT,               -- NULL for accounts created via OAuth only
  display_name   TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);

-- Links one or more OAuth identities (Google / Facebook / Apple) to a user.
-- A user can have a password AND one or more linked providers at the same time.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL, -- 'google' | 'facebook' | 'apple'
  provider_user_id  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

-- The "session" table is created automatically by connect-pg-simple
-- (createTableIfMissing: true in src/index.js), so it isn't defined here.
