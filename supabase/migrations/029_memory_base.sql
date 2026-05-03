-- Migration 029: Memory Base
-- Extends the graph-memory schema (025) so a saved plan becomes a real tree
-- of section/feature/sub-feature nodes with structured aspects, plus a
-- canonical approved-doc table the chunker diffs against on each Approve.

-- 1. Extend nodes with hierarchy + structured aspects + status + doc anchor
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES nodes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','in_progress','done','drifted','superseded')),
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aspects jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS doc_anchor text;

-- Allow new node kinds the chunker emits.
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_type_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_type_check CHECK (type IN (
  'project','section','feature','sub_feature','decision','error','fix',
  'session','file','plan','document','module','insight','team_member'
));

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_tree ON nodes(project_id, parent_id, order_index);
CREATE INDEX IF NOT EXISTS idx_nodes_aspects ON nodes USING gin (aspects);

-- Full-text index used by the cheap-first selection path on Starter plans.
CREATE INDEX IF NOT EXISTS idx_nodes_text_search ON nodes
  USING gin (to_tsvector('english', coalesce(label,'') || ' ' || coalesce(summary,'')));

-- 2. Allow new edge relationships emitted by the chunker
ALTER TABLE edges DROP CONSTRAINT IF EXISTS edges_relationship_type_check;
ALTER TABLE edges ADD CONSTRAINT edges_relationship_type_check CHECK (
  relationship_type IN (
    'built_from','caused','fixed_by','depends_on',
    'matched','drifted','contains','informed_by',
    'parent_of','references'
  )
);

-- 3. plan_docs — canonical approved doc per project, diffed by the chunker
CREATE TABLE IF NOT EXISTS plan_docs (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0,
  doc_md text NOT NULL DEFAULT '',
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_docs_user ON plan_docs(user_id);

ALTER TABLE plan_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_docs_owner ON plan_docs FOR ALL USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION touch_plan_docs_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_docs_updated_at ON plan_docs;
CREATE TRIGGER plan_docs_updated_at
  BEFORE UPDATE ON plan_docs
  FOR EACH ROW EXECUTE FUNCTION touch_plan_docs_updated_at();

-- 4. Cross-project memory selection RPC — used by memory_select_nodes
-- when a Pro+ user issues an embedding-based query across all their projects
-- (e.g. "you used X before — reuse it?").
CREATE OR REPLACE FUNCTION match_user_nodes(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 8
)
RETURNS TABLE(id uuid, project_id uuid, label text, summary text, similarity float) AS $$
  SELECT
    n.id,
    n.project_id,
    n.label,
    n.summary,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM nodes n
  WHERE n.user_id = match_user_id
    AND n.embedding IS NOT NULL
    AND n.status <> 'superseded'
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql SECURITY DEFINER;

-- 5. Tsvector-based selection for Starter (cheap-first) plans.
CREATE OR REPLACE FUNCTION search_user_nodes_text(
  query_text text,
  match_user_id uuid,
  match_project_id uuid DEFAULT NULL,
  match_count int DEFAULT 8
)
RETURNS TABLE(id uuid, project_id uuid, label text, summary text, rank float) AS $$
  SELECT
    n.id,
    n.project_id,
    n.label,
    n.summary,
    ts_rank(
      to_tsvector('english', coalesce(n.label,'') || ' ' || coalesce(n.summary,'')),
      plainto_tsquery('english', query_text)
    ) AS rank
  FROM nodes n
  WHERE n.user_id = match_user_id
    AND (match_project_id IS NULL OR n.project_id = match_project_id)
    AND n.status <> 'superseded'
    AND to_tsvector('english', coalesce(n.label,'') || ' ' || coalesce(n.summary,''))
        @@ plainto_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$ LANGUAGE sql SECURITY DEFINER;
