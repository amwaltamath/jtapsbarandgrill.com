-- ============================================================
-- Wallet Pass Push Notification Migration
-- (Superseded by wallet-pass-migration.sql — safe to re-run)
-- Adds authentication_token support to wallet_passes table
-- ============================================================

ALTER TABLE wallet_passes
  ADD COLUMN IF NOT EXISTS authentication_token TEXT;

CREATE INDEX IF NOT EXISTS idx_wallet_passes_auth_token
  ON wallet_passes(authentication_token)
  WHERE authentication_token IS NOT NULL;
