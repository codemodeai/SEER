-- SEER Agency Portal — Phase 4: Real-time Activity Tracking + Smart Suggestions
-- Adds: agency_activity table for tracking who's working on what

-- 1. Agency activity table — tracks member feature-level activity with heartbeat
CREATE TABLE IF NOT EXISTS agency_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  feature_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle')),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, user_id, project_name)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_agency_activity_agency_id ON agency_activity(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_activity_last_seen ON agency_activity(last_seen);
CREATE INDEX IF NOT EXISTS idx_agency_activity_status ON agency_activity(agency_id, status);

-- 3. Row Level Security
ALTER TABLE agency_activity ENABLE ROW LEVEL SECURITY;

-- Agency owner has full access
CREATE POLICY agency_activity_owner ON agency_activity
  FOR ALL USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

-- Agency admins have full access
CREATE POLICY agency_activity_admin ON agency_activity
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM agency_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Members can read all activity in their agency
CREATE POLICY agency_activity_member_read ON agency_activity
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

-- Members can insert/update their own activity
CREATE POLICY agency_activity_member_write ON agency_activity
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY agency_activity_member_update ON agency_activity
  FOR UPDATE USING (
    user_id = auth.uid() AND
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );
