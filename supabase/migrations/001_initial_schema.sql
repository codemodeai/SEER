-- Enable pgvector for memory embeddings (Step 4)
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  seer_api_key text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'agency')),
  usage_this_month int NOT NULL DEFAULT 0,
  stripe_customer_id text,
  ai_preference text DEFAULT 'claude',
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  summary text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seer logs (powers dashboard)
CREATE TABLE IF NOT EXISTS seer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  raw_input text,
  raw_tokens int NOT NULL DEFAULT 0,
  optimized_tokens int NOT NULL DEFAULT 0,
  tokens_saved int NOT NULL DEFAULT 0,
  pct_saved float NOT NULL DEFAULT 0,
  tool_used text NOT NULL,
  surface text DEFAULT 'unknown',
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Memory entries (vector memory - Step 4)
CREATE TABLE IF NOT EXISTS memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  entry_type text DEFAULT 'doc' CHECK (entry_type IN ('doc', 'task', 'decision', 'output')),
  importance float NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('dodo', 'razorpay')),
  provider_sub_id text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'agency')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_end timestamptz,
  UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_seer_api_key ON users(seer_api_key);
CREATE INDEX IF NOT EXISTS idx_seer_logs_user_id ON seer_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_seer_logs_timestamp ON seer_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_project_id ON memory_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE seer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY users_own ON users FOR ALL USING (id = auth.uid());
CREATE POLICY projects_own ON projects FOR ALL USING (user_id = auth.uid());
CREATE POLICY logs_own ON seer_logs FOR ALL USING (user_id = auth.uid());
CREATE POLICY subs_own ON subscriptions FOR ALL USING (user_id = auth.uid());

-- Daily savings RPC for dashboard
CREATE OR REPLACE FUNCTION daily_savings(uid uuid, days int)
RETURNS TABLE(day date, total_saved bigint) AS $$
  SELECT DATE(timestamp) as day, SUM(tokens_saved)::bigint as total_saved
  FROM seer_logs
  WHERE user_id = uid AND timestamp >= now() - (days || ' days')::interval
  GROUP BY day
  ORDER BY day;
$$ LANGUAGE sql SECURITY DEFINER;

-- Vector similarity search RPC for context memory
CREATE OR REPLACE FUNCTION match_memory(
  query_embedding vector(1536),
  match_project_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE(id uuid, content text, entry_type text, importance float, similarity float) AS $$
  SELECT
    m.id,
    m.content,
    m.entry_type,
    m.importance,
    (1 - (m.embedding <=> query_embedding)) * m.importance AS similarity
  FROM memory_entries m
  WHERE m.project_id = match_project_id
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql SECURITY DEFINER;

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_memory_embedding
  ON memory_entries USING hnsw (embedding vector_cosine_ops);
