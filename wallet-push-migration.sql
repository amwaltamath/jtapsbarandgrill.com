-- ============================================================
-- Wallet Pass Push Notification Migration
-- Adds authentication_token support to wallet_passes table
-- ============================================================

-- authentication_token: a 16-char hex secret embedded in the .pkpass
-- Apple sends it back in Authorization: ApplePass {token} headers
-- so we can verify requests to the web service endpoints
ALTER TABLE wallet_passes
  ADD COLUMN IF NOT EXISTS authentication_token TEXT;

-- Index for fast token lookups during web service auth
CREATE INDEX IF NOT EXISTS idx_wallet_passes_auth_token
  ON wallet_passes(authentication_token)
  WHERE authentication_token IS NOT NULL;
