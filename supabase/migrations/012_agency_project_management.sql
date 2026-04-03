-- SEER Agency Portal — Project Management
-- Adds: project boards, tasks, and task comments for agency team collaboration

-- 1. Project boards table
CREATE TABLE IF NOT EXISTS agency_pm_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agency_pm_projects_agency ON agency_pm_projects(agency_id);
CREATE INDEX idx_agency_pm_projects_status ON agency_pm_projects(agency_id, status);

-- 2. Tasks table
CREATE TABLE IF NOT EXISTS agency_pm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES agency_pm_projects(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agency_pm_tasks_project ON agency_pm_tasks(project_id);
CREATE INDEX idx_agency_pm_tasks_assigned ON agency_pm_tasks(assigned_to);
CREATE INDEX idx_agency_pm_tasks_status ON agency_pm_tasks(project_id, status);

-- 3. Task comments table
CREATE TABLE IF NOT EXISTS agency_pm_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES agency_pm_tasks(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agency_pm_comments_task ON agency_pm_comments(task_id);

-- 4. Row Level Security
ALTER TABLE agency_pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_pm_comments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by API routes via admin client)
CREATE POLICY agency_pm_projects_service ON agency_pm_projects FOR ALL
  USING (true) WITH CHECK (true);
CREATE POLICY agency_pm_tasks_service ON agency_pm_tasks FOR ALL
  USING (true) WITH CHECK (true);
CREATE POLICY agency_pm_comments_service ON agency_pm_comments FOR ALL
  USING (true) WITH CHECK (true);

-- 5. Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_pm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agency_pm_projects_updated_at
  BEFORE UPDATE ON agency_pm_projects
  FOR EACH ROW EXECUTE FUNCTION update_pm_updated_at();

CREATE TRIGGER agency_pm_tasks_updated_at
  BEFORE UPDATE ON agency_pm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_pm_updated_at();
