-- Migration: consolidate dual-currency price columns into price + currency
--
-- Changes:
--   products    : price_usd + price_khr  →  price + currency
--   order_items : price_at_sale_usd      →  price_at_sale + currency
--   orders      : total_amount_usd       →  total_amount + currency
--                 (amount_paid_usd, amount_paid_khr, change_given_khr unchanged —
--                  they track physically distinct cash drawers, not the same value)

BEGIN;

-- ================================================================
-- 1. PRODUCTS
-- ================================================================

ALTER TABLE products
  ADD COLUMN price    DECIMAL(10, 2),
  ADD COLUMN currency VARCHAR(3);

-- Prefer the USD price when both are set; fall back to KHR.
UPDATE products
SET
  price    = CASE WHEN price_usd > 0 THEN price_usd ELSE price_khr END,
  currency = CASE WHEN price_usd > 0 THEN 'USD'     ELSE 'KHR'    END;

ALTER TABLE products
  DROP CONSTRAINT chk_at_least_one_price,
  ALTER COLUMN price    SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ADD  CONSTRAINT chk_products_currency CHECK (currency IN ('USD', 'KHR')),
  DROP COLUMN price_usd,
  DROP COLUMN price_khr;

-- ================================================================
-- 2. ORDER_ITEMS
-- ================================================================

ALTER TABLE order_items
  ADD COLUMN price_at_sale DECIMAL(10, 2),
  ADD COLUMN currency      VARCHAR(3);

-- All historical rows were recorded in USD.
UPDATE order_items
SET
  price_at_sale = price_at_sale_usd,
  currency      = 'USD';

ALTER TABLE order_items
  ALTER COLUMN price_at_sale SET NOT NULL,
  ALTER COLUMN currency      SET NOT NULL,
  ADD  CONSTRAINT chk_order_items_currency CHECK (currency IN ('USD', 'KHR')),
  DROP COLUMN price_at_sale_usd;

-- ================================================================
-- 3. ORDERS  (total only — payment amounts stay as-is)
-- ================================================================

ALTER TABLE orders
  ADD COLUMN total_amount DECIMAL(10, 2),
  ADD COLUMN currency     VARCHAR(3);

-- All historical orders were denominated in USD.
UPDATE orders
SET
  total_amount = total_amount_usd,
  currency     = 'USD';

ALTER TABLE orders
  ALTER COLUMN total_amount SET NOT NULL,
  ALTER COLUMN currency     SET NOT NULL,
  ADD  CONSTRAINT chk_orders_currency CHECK (currency IN ('USD', 'KHR')),
  DROP COLUMN total_amount_usd;

COMMIT;
