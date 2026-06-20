-- =============================================================================
-- 003_add_static_qr.sql
-- Add STATIC_QR payment type and bank_name tracking to orders.
--
-- Run this on existing databases only. Fresh installs already include
-- these changes via 001_initial_schema.sql.
-- =============================================================================

-- Add the new payment type value
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'STATIC_QR';

-- Track which bank's printed QR code was used (NULL for CASH / KHQR orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
