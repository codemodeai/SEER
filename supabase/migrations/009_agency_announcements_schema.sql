-- SEER Agency Portal — Phase 5: Announcements System
-- Adds: agency_announcements table for admin-to-team communication

-- 1. Agency announcements table
CREATE TABLE IF NOT EXISTS agency_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_agency_announcements_agency_id ON agency_announcements(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_announcements_pinned ON agency_announcements(agency_id, pinned);
CREATE INDEX IF NOT EXISTS idx_agency_announcements_created ON agency_announcements(agency_id, created_at DESC);

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_announcement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_announcement_updated_at
  BEFORE UPDATE ON agency_announcements
  FOR EACH ROW EXECUTE FUNCTION update_announcement_updated_at();

-- 4. Row Level Security
ALTER TABLE agency_announcements ENABLE ROW LEVEL SECURITY;

-- Agency owner has full access
CREATE POLICY agency_announcements_owner ON agency_announcements
  FOR ALL USING (
    agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())
  );

-- Agency admins have full access
CREATE POLICY agency_announcements_admin ON agency_announcements
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM agency_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Members can read announcements in their agency
CREATE POLICY agency_announcements_member_read ON agency_announcements
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
    )
  );
