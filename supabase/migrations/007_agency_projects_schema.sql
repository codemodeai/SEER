-- SEER Agency Portal — Phase 3: Cloud Memory Sync
-- Adds: agency_projects table for shared .seer_memory.md cloud storage

-- 1. Agency projects table — stores synced .seer_memory.md per project
CREATE TABLE IF NOT EXISTS agency_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  cloud_memory text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, project_name)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_agency_projects_agency_id ON agency_projects(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_projects_updated_at ON agency_projects(updated_at);

-- 3. Row Level Security
ALTER TABLE agency_projects ENABLE ROW LEVEL SECURITY;

-- Agency owner has full access to all projects
CREATE POLICY agency_projects_owner ON agency_projects
  FOR ALL USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

-- Agency admins have full access
CREATE POLICY agency_projects_admin ON agency_projects
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM agency_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Agency members can read and push (SELECT + INSERT + UPDATE)
CREATE POLICY agency_projects_member_read ON agency_projects
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY agency_projects_member_write ON agency_projects
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY agency_projects_member_update ON agency_projects
  FOR UPDATE USING (
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

-- 4. Auto-update updated_at trigger
CREATE TRIGGER agency_projects_updated_at
  BEFORE UPDATE ON agency_projects
  FOR EACH ROW EXECUTE FUNCTION update_agency_updated_at();
