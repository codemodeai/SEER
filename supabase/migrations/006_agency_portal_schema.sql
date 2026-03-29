-- SEER Agency Portal — Phase 1 Schema Migration
-- Adds: agencies table, agency_users table, RLS policies, helper RPCs

-- 1. Agencies table — one row per agency customer
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'agency' CHECK (plan IN ('agency')),
  max_users int NOT NULL DEFAULT 10,
  logo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Slug must be lowercase alphanumeric + hyphens only
ALTER TABLE agencies ADD CONSTRAINT agencies_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(slug) >= 3 AND length(slug) <= 48);

-- 2. Agency users table — maps users to agencies with roles
CREATE TABLE IF NOT EXISTS agency_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  assigned_plan text NOT NULL DEFAULT 'starter' CHECK (assigned_plan IN ('starter', 'pro')),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, user_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_agencies_owner_id ON agencies(owner_id);
CREATE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_agency_users_agency_id ON agency_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_user_id ON agency_users(user_id);

-- 4. Row Level Security
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;

-- Agency owner can do everything on their agency
CREATE POLICY agencies_owner ON agencies
  FOR ALL USING (owner_id = auth.uid());

-- Agency members can SELECT their agency (read-only)
CREATE POLICY agencies_member_read ON agencies
  FOR SELECT USING (
    id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
  );

-- Agency owner can manage all agency_users rows in their agency
CREATE POLICY agency_users_owner ON agency_users
  FOR ALL USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

-- Agency admins can manage members (but not other admins)
CREATE POLICY agency_users_admin ON agency_users
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM agency_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (role = 'member');

-- Members can read their own row
CREATE POLICY agency_users_self ON agency_users
  FOR SELECT USING (user_id = auth.uid());

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_agency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_agency_updated_at();

-- 6. Helper RPC — get agency with member count (for admin dashboard)
CREATE OR REPLACE FUNCTION get_agency_with_members(agency_slug text)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  max_users int,
  status text,
  member_count bigint,
  created_at timestamptz
) AS $$
  SELECT
    a.id, a.name, a.slug, a.owner_id, a.max_users, a.status,
    COUNT(au.id)::bigint AS member_count,
    a.created_at
  FROM agencies a
  LEFT JOIN agency_users au ON au.agency_id = a.id
  WHERE a.slug = agency_slug
    AND (a.owner_id = auth.uid() OR a.id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    ))
  GROUP BY a.id, a.name, a.slug, a.owner_id, a.max_users, a.status, a.created_at;
$$ LANGUAGE sql SECURITY DEFINER;

-- 7. Helper RPC — list members of an agency (for user management page)
CREATE OR REPLACE FUNCTION list_agency_members(target_agency_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  role text,
  assigned_plan text,
  usage_this_month int,
  joined_at timestamptz
) AS $$
  SELECT
    u.id AS user_id,
    u.email,
    au.role,
    au.assigned_plan,
    u.usage_this_month,
    au.joined_at
  FROM agency_users au
  JOIN users u ON u.id = au.user_id
  WHERE au.agency_id = target_agency_id
    AND (
      target_agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
      OR target_agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid() AND role = 'admin')
    )
  ORDER BY au.joined_at;
$$ LANGUAGE sql SECURITY DEFINER;

-- 8. Helper RPC — check if agency can add more users
CREATE OR REPLACE FUNCTION agency_can_add_user(target_agency_id uuid)
RETURNS boolean AS $$
  SELECT COUNT(au.id) < a.max_users
  FROM agencies a
  LEFT JOIN agency_users au ON au.agency_id = a.id
  WHERE a.id = target_agency_id
  GROUP BY a.max_users;
$$ LANGUAGE sql SECURITY DEFINER;
