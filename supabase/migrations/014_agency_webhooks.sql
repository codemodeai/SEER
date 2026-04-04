-- Migration 014: Agency Webhooks
-- Webhook integrations for agency events (member changes, announcements, projects, memory sync)

-- Webhook endpoints registered by agency admins
CREATE TABLE IF NOT EXISTS agency_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- HMAC-SHA256 signing secret
  events TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'member.joined','announcement.created'}
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery log for debugging
CREATE TABLE IF NOT EXISTS agency_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES agency_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status_code INT,
  response_body TEXT DEFAULT '',
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agency_webhooks_agency ON agency_webhooks(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_webhooks_active ON agency_webhooks(agency_id, active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON agency_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_time ON agency_webhook_deliveries(attempted_at DESC);

-- RLS
ALTER TABLE agency_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Policy: agency owner/admin can manage webhooks
CREATE POLICY "agency_webhooks_owner_admin" ON agency_webhooks
  FOR ALL USING (
    agency_id IN (
      SELECT id FROM agencies WHERE owner_id = auth.uid()
    )
    OR
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: delivery logs readable by owner/admin
CREATE POLICY "webhook_deliveries_owner_admin" ON agency_webhook_deliveries
  FOR SELECT USING (
    webhook_id IN (
      SELECT w.id FROM agency_webhooks w
      JOIN agencies a ON a.id = w.agency_id
      WHERE a.owner_id = auth.uid()
    )
    OR
    webhook_id IN (
      SELECT w.id FROM agency_webhooks w
      JOIN agency_users au ON au.agency_id = w.agency_id
      WHERE au.user_id = auth.uid() AND au.role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_webhook_updated_at
  BEFORE UPDATE ON agency_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();
