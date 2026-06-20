-- =============================================================================
-- 001_initial_schema.sql
-- SOSO BABY MART — Point of Sale System
--
-- Canonical fresh-database setup. Creates all types, tables, indexes, and
-- default store settings.
--
-- Note: migrate_single_currency.sql has been retired. Its changes (consolidating
-- dual-currency price columns into a single price + currency column) are already
-- reflected in this schema and do not need to be applied separately.
-- =============================================================================

BEGIN;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE payment_type AS ENUM ('CASH', 'KHQR', 'STATIC_QR');
CREATE TYPE order_status  AS ENUM ('COMPLETED', 'CANCELLED');
CREATE TYPE khqr_status   AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE customers (
    id             SERIAL       PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    phone_number   VARCHAR(20)  UNIQUE,
    loyalty_points INT          NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id         SERIAL         PRIMARY KEY,
    name       VARCHAR(255)   NOT NULL,
    barcode    VARCHAR(50)    NOT NULL UNIQUE,
    price      DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    currency   VARCHAR(3)     NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'KHR')),
    stock      INT            NOT NULL DEFAULT 0     CHECK (stock >= 0),
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id               SERIAL         PRIMARY KEY,
    customer_id      INT            REFERENCES customers(id) ON DELETE SET NULL,
    total_amount     DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    currency         VARCHAR(3)     NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'KHR')),
    payment_method   payment_type   NOT NULL,
    -- Tracked separately: customers may tender physical USD and KHR simultaneously
    amount_paid_usd  DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid_usd  >= 0),
    amount_paid_khr  DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid_khr  >= 0),
    change_given_khr DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (change_given_khr >= 0),
    bank_name        VARCHAR(100),
    status           order_status   NOT NULL DEFAULT 'COMPLETED',
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id            SERIAL         PRIMARY KEY,
    order_id      INT            NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    product_id    INT            REFERENCES products(id)          ON DELETE SET NULL,
    quantity      INT            NOT NULL CHECK (quantity > 0),
    price_at_sale DECIMAL(10, 2) NOT NULL CHECK (price_at_sale > 0),
    currency      VARCHAR(3)     NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'KHR'))
);

CREATE TABLE khqr_transactions (
    id                   SERIAL         PRIMARY KEY,
    order_id             INT            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    md5_hash             VARCHAR(255)   NOT NULL UNIQUE,
    qr_string            TEXT           NOT NULL,
    bank_name            VARCHAR(100),
    transaction_currency VARCHAR(3)     NOT NULL DEFAULT 'USD',
    amount               DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    status               khqr_status    NOT NULL DEFAULT 'PENDING',
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE store_settings (
    key        VARCHAR(50) PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- PostgreSQL does not auto-index foreign keys — create them explicitly.
-- Unique constraints already carry an implicit index (barcode, md5_hash).
-- =============================================================================

CREATE INDEX idx_orders_created_at    ON orders            (created_at DESC);
CREATE INDEX idx_orders_customer_id   ON orders            (customer_id);
CREATE INDEX idx_order_items_order_id ON order_items       (order_id);
CREATE INDEX idx_khqr_order_id        ON khqr_transactions (order_id);

-- =============================================================================
-- DEFAULT STORE SETTINGS
-- These are the initial values. All can be updated at runtime through the
-- Settings screen in the app — no database access required.
-- =============================================================================

INSERT INTO store_settings (key, value) VALUES
    ('exchange_rate',        '4100'),
    ('locale',               'km'),
    ('main_currency',        'USD'),
    ('bakong_account_id',    'your_account@bank'),
    ('bakong_merchant_name', 'SOSO Baby Mart'),
    ('bakong_merchant_city', 'Phnom Penh')
ON CONFLICT (key) DO NOTHING;

COMMIT;
