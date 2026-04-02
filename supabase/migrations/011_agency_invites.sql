-- Agency invites table — tracks pending email invitations
CREATE TABLE IF NOT EXISTS public.agency_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  assigned_plan TEXT NOT NULL DEFAULT 'starter' CHECK (assigned_plan IN ('starter', 'pro')),
  token       TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_agency_invites_token ON public.agency_invites(token);
CREATE INDEX IF NOT EXISTS idx_agency_invites_agency_status ON public.agency_invites(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_agency_invites_email ON public.agency_invites(email);

-- RLS
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (API routes use admin client)
CREATE POLICY "Service role full access on agency_invites"
  ON public.agency_invites
  FOR ALL
  USING (true)
  WITH CHECK (true);
