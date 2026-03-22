-- Add missing UNIQUE constraint on (user_id, provider) for subscriptions table.
-- Required for the upsert({ onConflict: "user_id,provider" }) used in payment routes.
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_provider_key UNIQUE (user_id, provider);

-- Create invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 0,
  amount_inr numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_id text,
  provider text,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_own ON invoices FOR ALL USING (user_id = auth.uid());

-- Index for faster invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
