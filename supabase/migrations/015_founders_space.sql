-- Founder's Space — Phase 1 Schema Migration
-- Adds: fs_projects, fs_tasks, fs_credentials, fs_documents, fs_notes tables
-- Adds: fs_access boolean to users table (auto-true for pro/agency)

-- 1. Add fs_access flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS fs_access boolean NOT NULL DEFAULT false;

-- Auto-enable for pro and agency users
UPDATE users SET fs_access = true WHERE plan IN ('pro', 'agency');

-- 2. Founder's Space Projects
CREATE TABLE IF NOT EXISTS fs_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_projects_user ON fs_projects(user_id);

ALTER TABLE fs_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_projects_owner" ON fs_projects
  FOR ALL USING (user_id = auth.uid());

-- 3. Founder's Space Tasks
CREATE TABLE IF NOT EXISTS fs_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES fs_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'blocked')),
  due_date date,
  created_via text NOT NULL DEFAULT 'dashboard' CHECK (created_via IN ('dashboard', 'mcp')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_tasks_user ON fs_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_tasks_project ON fs_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_fs_tasks_status ON fs_tasks(status);

ALTER TABLE fs_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_tasks_owner" ON fs_tasks
  FOR ALL USING (user_id = auth.uid());

-- 4. Founder's Space Credentials (encrypted)
CREATE TABLE IF NOT EXISTS fs_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES fs_projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  value_encrypted text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  environment text DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_credentials_user ON fs_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_credentials_project ON fs_credentials(project_id);

ALTER TABLE fs_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_credentials_owner" ON fs_credentials
  FOR ALL USING (user_id = auth.uid());

-- 5. Founder's Space Documents
CREATE TABLE IF NOT EXISTS fs_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES fs_projects(id) ON DELETE CASCADE,
  filename text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other' CHECK (doc_type IN ('agreement', 'certificate', 'invoice', 'other')),
  expiry_date date,
  tags text[] DEFAULT '{}',
  storage_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_documents_user ON fs_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_documents_project ON fs_documents(project_id);

ALTER TABLE fs_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_documents_owner" ON fs_documents
  FOR ALL USING (user_id = auth.uid());

-- 6. Founder's Space Notes (append-only)
CREATE TABLE IF NOT EXISTS fs_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES fs_projects(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_notes_user ON fs_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_notes_project ON fs_notes(project_id);

ALTER TABLE fs_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_notes_owner" ON fs_notes
  FOR ALL USING (user_id = auth.uid());
