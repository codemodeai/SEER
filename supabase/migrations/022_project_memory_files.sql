-- Migration 022: Structured aspect-memory files
-- Replaces flat .seer_memory.md with 6 dedicated aspect files per project.
-- SEER loads only the relevant files per task — not all six every time.

CREATE TYPE aspect_type AS ENUM (
  'project_overview',
  'architecture',
  'features',
  'decisions',
  'errors_fixes',
  'session_log'
);

CREATE TABLE IF NOT EXISTS project_memory_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  aspect_type aspect_type NOT NULL,
  content text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  size_bytes int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (scope, project, aspect). Personal rows key on user_id; agency rows key on agency_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pmf_personal
  ON project_memory_files(user_id, project_name, aspect_type)
  WHERE agency_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pmf_agency
  ON project_memory_files(agency_id, project_name, aspect_type)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pmf_user_id ON project_memory_files(user_id);
CREATE INDEX IF NOT EXISTS idx_pmf_agency_id ON project_memory_files(agency_id);
CREATE INDEX IF NOT EXISTS idx_pmf_updated_at ON project_memory_files(updated_at DESC);

ALTER TABLE project_memory_files ENABLE ROW LEVEL SECURITY;

-- Personal: owner full access
CREATE POLICY pmf_owner_all ON project_memory_files
  FOR ALL USING (
    agency_id IS NULL AND user_id = auth.uid()
  );

-- Agency: members read, admins write
CREATE POLICY pmf_agency_read ON project_memory_files
  FOR SELECT USING (
    agency_id IS NOT NULL AND (
      agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
      OR agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY pmf_agency_write ON project_memory_files
  FOR INSERT WITH CHECK (
    agency_id IS NOT NULL AND (
      agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
      OR agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY pmf_agency_update ON project_memory_files
  FOR UPDATE USING (
    agency_id IS NOT NULL AND (
      agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
      OR agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY pmf_agency_delete ON project_memory_files
  FOR DELETE USING (
    agency_id IS NOT NULL AND (
      agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
      OR agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid() AND role = 'admin')
    )
  );

CREATE OR REPLACE FUNCTION touch_pmf_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  NEW.size_bytes = octet_length(NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pmf_updated_at
  BEFORE UPDATE ON project_memory_files
  FOR EACH ROW EXECUTE FUNCTION touch_pmf_updated_at();

CREATE TRIGGER pmf_insert_size
  BEFORE INSERT ON project_memory_files
  FOR EACH ROW EXECUTE FUNCTION touch_pmf_updated_at();
