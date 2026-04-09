-- Admin expenses table for tracking recurring costs (DB, hosting, APIs, domains, etc.)
CREATE TABLE IF NOT EXISTS admin_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other', -- api, database, hosting, domain, service, other
  amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, annual, one-time
  provider TEXT, -- e.g. "Supabase", "Vercel", "Anthropic", "Cloudflare"
  notes TEXT,
  due_date DATE, -- next payment due
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: only service role can access (admin routes use getSupabaseAdmin)
ALTER TABLE admin_expenses ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — admin routes use service role key which bypasses RLS
