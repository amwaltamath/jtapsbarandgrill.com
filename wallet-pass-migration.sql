-- ============================================================
-- Wallet Passes Migration
-- Track Apple Wallet and Google Wallet pass installations
-- ============================================================

-- Table to track issued wallet passes per customer
CREATE TABLE IF NOT EXISTS wallet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_type TEXT NOT NULL CHECK (pass_type IN ('apple', 'google')),
  pass_serial TEXT NOT NULL UNIQUE,
  device_library_id TEXT,
  push_token TEXT,
  authentication_token TEXT,
  points_snapshot INT DEFAULT 0,
  tier_snapshot TEXT DEFAULT 'bronze',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_wallet_passes_user_id ON wallet_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_serial ON wallet_passes(pass_serial);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_auth_token
  ON wallet_passes(authentication_token)
  WHERE authentication_token IS NOT NULL;

-- RLS policies
ALTER TABLE wallet_passes ENABLE ROW LEVEL SECURITY;

-- Customers can view their own wallet passes
CREATE POLICY "Users can view own wallet passes"
  ON wallet_passes FOR SELECT
  USING (auth.uid() = user_id);

-- Only server (service role) can insert/update wallet passes
CREATE POLICY "Service role can manage wallet passes"
  ON wallet_passes FOR ALL
  USING (auth.role() = 'service_role');

-- Add loyalty tier fields to customer_profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' AND column_name = 'loyalty_tier'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN loyalty_tier TEXT DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_profiles' AND column_name = 'member_since'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN member_since DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Ensure checkin_points column exists (added in Phase 6, but may not be present yet)
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS checkin_points INT DEFAULT 0;

-- Function to compute loyalty tier from points
CREATE OR REPLACE FUNCTION compute_loyalty_tier(points INT)
RETURNS TEXT AS $$
BEGIN
  IF points >= 300 THEN RETURN 'gold';
  ELSIF points >= 100 THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update loyalty_tier when checkin_points change
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.loyalty_tier := compute_loyalty_tier(COALESCE(NEW.checkin_points, 0));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_loyalty_tier ON customer_profiles;
CREATE TRIGGER trg_update_loyalty_tier
  BEFORE INSERT OR UPDATE OF checkin_points ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tier();
