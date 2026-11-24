
ALTER TABLE otp_verifications
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_otp_expiry
ON otp_verifications(expires_at);
