-- Migration 018: Add agency_id to fs_projects for team shared projects
-- Enables agency teams to share projects in Founder's Space

ALTER TABLE fs_projects ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fs_projects_agency ON fs_projects(agency_id) WHERE agency_id IS NOT NULL;

-- Team read: any agency member can see team projects
CREATE POLICY "fs_projects_team_read" ON fs_projects
  FOR SELECT USING (
    agency_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM agencies WHERE id = fs_projects.agency_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM agency_users WHERE agency_id = fs_projects.agency_id AND user_id = auth.uid())
    )
  );

-- Team write: owner or admin can create/update/delete team projects
CREATE POLICY "fs_projects_team_write" ON fs_projects
  FOR ALL USING (
    agency_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM agencies WHERE id = fs_projects.agency_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM agency_users WHERE agency_id = fs_projects.agency_id AND user_id = auth.uid() AND role = 'admin')
    )
  );
