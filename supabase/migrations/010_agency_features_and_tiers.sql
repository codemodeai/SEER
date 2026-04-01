-- SEER Agency Portal — Tiered pricing + feature toggles
-- Adds: member_tier, base_price, enabled_features, addons to agencies table

-- 1. Add tier and feature columns to agencies
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS member_tier text NOT NULL DEFAULT '1-5'
    CHECK (member_tier IN ('1-5', '6-10', '11-15', '16-20', '21-25', '26-30')),
  ADD COLUMN IF NOT EXISTS base_price integer NOT NULL DEFAULT 59,
  ADD COLUMN IF NOT EXISTS addon_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled_features jsonb NOT NULL DEFAULT '{"announcements": true, "project_management": false}'::jsonb;

-- 2. Index for feature lookups
CREATE INDEX IF NOT EXISTS idx_agencies_enabled_features ON agencies USING gin(enabled_features);
