-- POS Import Integration Migration
-- Adds pos_card_number to newsletter_subscribers and loyalty_members
-- for syncing data between the POS system and the JTAPS app

-- Add POS card number and birthday to newsletter_subscribers
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS pos_card_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS birthday TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS pos_register_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pos_last_visit TIMESTAMP WITH TIME ZONE;

-- Add POS card number and total points to loyalty_members
ALTER TABLE loyalty_members
  ADD COLUMN IF NOT EXISTS pos_card_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pos_points DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_total_points DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_dollars DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_last_synced TIMESTAMP WITH TIME ZONE;

-- Create POS import log table
CREATE TABLE IF NOT EXISTS pos_import_log (
  id BIGSERIAL PRIMARY KEY,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_records INT DEFAULT 0,
  new_subscribers INT DEFAULT 0,
  updated_subscribers INT DEFAULT 0,
  new_loyalty INT DEFAULT 0,
  updated_loyalty INT DEFAULT 0,
  imported_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE pos_import_log ENABLE ROW LEVEL SECURITY;

-- Admin-only policy for pos_import_log
CREATE POLICY "Admin full access to pos_import_log"
  ON pos_import_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Index for fast lookups by POS card number
CREATE INDEX IF NOT EXISTS idx_newsletter_pos_card ON newsletter_subscribers(pos_card_number) WHERE pos_card_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_pos_card ON loyalty_members(pos_card_number) WHERE pos_card_number IS NOT NULL;
