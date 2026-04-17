-- Migration 024: queued_tasks
-- Stores tasks queued from complement devices (mobile or desktop) to be executed
-- by the primary device agent via Supabase Realtime. Also used for offline queueing.

CREATE TABLE IF NOT EXISTS queued_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_text   text NOT NULL,
  project_name text,
  source_device text,                          -- device identifier (e.g. "mobile", "complement-desktop")
  status      text NOT NULL DEFAULT 'pending', -- pending | running | done | failed
  result      text,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE queued_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_queued_tasks"
  ON queued_tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast polling by primary agent
CREATE INDEX IF NOT EXISTS idx_queued_tasks_user_status
  ON queued_tasks (user_id, status, created_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_queued_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER queued_tasks_updated_at
  BEFORE UPDATE ON queued_tasks
  FOR EACH ROW EXECUTE FUNCTION update_queued_tasks_updated_at();

-- Enable Realtime on this table so the primary agent receives new tasks instantly
ALTER TABLE queued_tasks REPLICA IDENTITY FULL;
