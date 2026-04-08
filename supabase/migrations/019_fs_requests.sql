-- Migration 019: Founder's Space team requests
-- Agency members can request credentials/resources from owner/admin

CREATE TABLE IF NOT EXISTS fs_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES fs_projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'credential',  -- credential, document, access, other
  status text NOT NULL DEFAULT 'pending',        -- pending, in_progress, done, rejected
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolve_note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fs_requests_agency ON fs_requests(agency_id);
CREATE INDEX idx_fs_requests_user ON fs_requests(user_id);
CREATE INDEX idx_fs_requests_status ON fs_requests(agency_id, status);

ALTER TABLE fs_requests ENABLE ROW LEVEL SECURITY;

-- Members can read their own requests
CREATE POLICY "fs_requests_own_read" ON fs_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Members can create requests
CREATE POLICY "fs_requests_own_insert" ON fs_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Owner/admin can read all agency requests
CREATE POLICY "fs_requests_team_read" ON fs_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM agencies WHERE id = fs_requests.agency_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM agency_users WHERE agency_id = fs_requests.agency_id AND user_id = auth.uid() AND role = 'admin')
  );

-- Owner/admin can update requests (mark done, reject, add notes)
CREATE POLICY "fs_requests_team_update" ON fs_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM agencies WHERE id = fs_requests.agency_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM agency_users WHERE agency_id = fs_requests.agency_id AND user_id = auth.uid() AND role = 'admin')
  );
