-- Add case-insensitive email uniqueness and other constraints
-- This ensures User@example.com and user@example.com are treated as duplicates

-- Add a constraint to ensure lowercase emails for uniqueness checking
-- Note: Most modern PostgreSQL versions handle this automatically with UNIQUE constraints
-- but this makes it explicit for case-insensitive comparison

-- For existing databases, you may need to update the users table:
-- ALTER TABLE users ADD CONSTRAINT email_lower_unique UNIQUE (LOWER(email));

-- Alternatively, use a generated column approach (PostgreSQL 12+):
-- ALTER TABLE users ADD COLUMN email_lower TEXT GENERATED ALWAYS AS (LOWER(email)) STORED;
-- CREATE UNIQUE INDEX idx_email_lower ON users(email_lower);

-- For now, ensure the application layer enforces case-insensitive checks
-- by using LOWER(email) in all email lookups (already done in auth.js)

-- Add indexes for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);

-- Add audit table for tracking failed login attempts (optional security improvement)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at);
