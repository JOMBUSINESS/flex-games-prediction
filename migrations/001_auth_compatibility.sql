-- Run once against an existing database before deploying the updated API.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'super_admin', 'analyst', 'support'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
  ON users(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS otp_verifications (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(30) NOT NULL,
  code_hash TEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'phone_verification',
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose
  ON otp_verifications(phone, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_resets_token
  ON password_resets(token_hash);

COMMIT;
