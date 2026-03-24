-- SEER v1.0.1 Schema Migration
-- Adds: user preference columns, security incidents table, nudge tracking

-- 1. Users table — new columns for v1.0.1 features
ALTER TABLE users ADD COLUMN IF NOT EXISTS suggestion_skin TEXT DEFAULT 'default';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_suggest BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMPTZ;

-- 2. Security incidents table — logs all blocked requests
CREATE TABLE IF NOT EXISTS security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  ip_address text,
  user_id uuid REFERENCES users(id),
  api_key_prefix text,
  payload_snippet text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(event_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON security_incidents(created_at);

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

-- Service role can insert (server-side only), no user reads
CREATE POLICY security_incidents_insert ON security_incidents
  FOR INSERT WITH CHECK (true);
