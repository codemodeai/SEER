-- Migration 021: Add billing_cycle column to subscriptions table
-- Supports monthly/annual billing toggle

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
CHECK (billing_cycle IN ('monthly', 'annual'));

-- Update existing subscriptions (all are monthly)
UPDATE subscriptions SET billing_cycle = 'monthly' WHERE billing_cycle IS NULL;
