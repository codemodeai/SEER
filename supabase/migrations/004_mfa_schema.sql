-- SEER v1.1 Schema Migration
-- Adds: MFA verification flag + lifetime prompt counter for one-time TOTP enforcement

-- 1. Users table — MFA columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS prompt_count INT DEFAULT 0;
