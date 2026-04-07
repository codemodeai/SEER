-- Founder's Space Phase 5 — Agency Team Shared Vault
-- Adds agency_id to fs_tasks, fs_credentials, fs_documents, fs_notes
-- Items with agency_id set are shared with all agency members

-- 1. Add agency_id columns
ALTER TABLE fs_tasks ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE fs_credentials ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE fs_documents ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;
ALTER TABLE fs_notes ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL;

-- 2. Indexes for team queries
CREATE INDEX IF NOT EXISTS idx_fs_tasks_agency ON fs_tasks(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fs_credentials_agency ON fs_credentials(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fs_documents_agency ON fs_documents(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fs_notes_agency ON fs_notes(agency_id) WHERE agency_id IS NOT NULL;

-- 3. RLS policies for team access — agency members can read shared items
-- Tasks: members can read team tasks
CREATE POLICY "fs_tasks_team_read" ON fs_tasks
  FOR SELECT USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

-- Tasks: owner/admin can insert/update/delete team tasks
CREATE POLICY "fs_tasks_team_write" ON fs_tasks
  FOR ALL USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid() AND role IN ('admin')
      UNION
      SELECT id FROM agencies WHERE owner_id = auth.uid()
    )
  );

-- Credentials: members can read (metadata only — values stay encrypted)
CREATE POLICY "fs_credentials_team_read" ON fs_credentials
  FOR SELECT USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

-- Credentials: only owner/admin can write shared credentials
CREATE POLICY "fs_credentials_team_write" ON fs_credentials
  FOR ALL USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid() AND role IN ('admin')
      UNION
      SELECT id FROM agencies WHERE owner_id = auth.uid()
    )
  );

-- Documents: members can read shared docs
CREATE POLICY "fs_documents_team_read" ON fs_documents
  FOR SELECT USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

-- Documents: owner/admin can write shared docs
CREATE POLICY "fs_documents_team_write" ON fs_documents
  FOR ALL USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid() AND role IN ('admin')
      UNION
      SELECT id FROM agencies WHERE owner_id = auth.uid()
    )
  );

-- Notes: members can read shared notes
CREATE POLICY "fs_notes_team_read" ON fs_notes
  FOR SELECT USING (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );

-- Notes: any agency member can write shared notes (append-only, collaborative)
CREATE POLICY "fs_notes_team_write" ON fs_notes
  FOR INSERT WITH CHECK (
    agency_id IS NOT NULL AND agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );
