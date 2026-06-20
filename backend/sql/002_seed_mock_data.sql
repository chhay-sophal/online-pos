-- =============================================================================
-- 002_seed_mock_data.sql
-- SOSO BABY MART — Development mock data
--
-- WARNING: Truncates products, orders, order_items, khqr_transactions and
--          resets their sequences. Run only in development.
--
-- Apply after 001_initial_schema.sql:
--   psql -d <db> -f 002_seed_mock_data.sql
-- =============================================================================

BEGIN;

TRUNCATE products, orders, order_items, khqr_transactions
  RESTART IDENTITY CASCADE;

-- =============================================================================
-- 20 PRODUCTS  (IDs 1–20 after identity reset)
-- Mix: 17 USD-priced, 3 KHR-priced; some low-stock (≤5) for filter testing
-- =============================================================================

INSERT INTO products (name, barcode, price, currency, stock) VALUES
-- id auto-assigned 1–20 after RESTART IDENTITY
  ('Enfamil A+ Stage 1 (400g)',        '884321678901',  18.50, 'USD',   24),
  ('Enfamil A+ Stage 2 (400g)',        '884321678902',  17.90, 'USD',   18),
  ('Similac GainPlus (700g)',          '070000010701',  22.50, 'USD',   12),
  ('NAN OPTIPRO Stage 1 (400g)',       '760491180551',  16.80, 'USD',   20),
  ('Dumex Mamil Gold (400g)',          '072499101459',  15.90, 'USD',    8),
  ('Lactogen Stage 1 (400g)',          '600007000012', 65000,  'KHR',   30),
  ('Bear Brand Powdered Milk (300g)',  '600007000013', 21000,  'KHR',   25),
  ('Milo Activ-Go (600g)',             '600007000014', 18000,  'KHR',    3),
  ('Pampers Pants XL 46s',            '490243075631',  14.20, 'USD',   15),
  ('Pampers Pants L 52s',             '490243075632',  12.80, 'USD',   20),
  ('MamyPoko Pants XL 46s',           '885210004678',  11.50, 'USD',   22),
  ('Huggies Gold Wipes 80s',          '622100000014',   3.50, 'USD',   40),
  ('MamyPoko Wipes 80s',              '885111112222',   2.25, 'USD',   50),
  ('MamyPoko Wipes 40s',              '885111112223',   1.50, 'USD',   35),
  ('Johnson''s Baby Shampoo 200ml',   '381370030002',   3.20, 'USD',   28),
  ('Dettol Baby Wash 200ml',          '614531900047',   4.10, 'USD',   17),
  ('Pigeon Baby Bottle 150ml',        '498600012345',   8.90, 'USD',   10),
  ('Avent Natural Bottle 125ml',      '010794301018',  12.50, 'USD',    7),
  ('NUK Soother 0-6m',               '400094027082',   5.50, 'USD',   14),
  ('Mustela Gentle Cleanser 200ml',  '370001300012',   9.80, 'USD',    5);

-- =============================================================================
-- 20 ORDERS — spread across the last 30 days
-- change_given_khr = (paid_usd - total_amount) * 4100
-- KHQR orders carry no tendered amounts (digital settlement)
-- =============================================================================
--
-- Totals verified against order_items below:
--  #1  $18.50   #2  $7.70   #3  $21.20  #4  $16.80  #5  $31.40
--  #6  $33.50   #7  $11.50  #8  $29.50  #9  $14.20  #10  $9.80
--  #11 $22.50   #12 $15.50  #13  $7.70  #14 $60.80  #15 $15.90
--  #16 $12.50   #17 $37.75  #18  $5.50  #19 $22.00  #20 $85.70

INSERT INTO orders
  (total_amount, currency, payment_method, amount_paid_usd, amount_paid_khr, change_given_khr, created_at)
VALUES
  -- order 1 : $18.50  CASH  pay $20.00 → change $1.50×4100 = 6 150 KHR
  (18.50, 'USD', 'CASH',  20.00, 0,  6150.00, NOW() - INTERVAL  '1 day'),
  -- order 2 : $7.70   KHQR
  ( 7.70, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL  '2 days'),
  -- order 3 : $21.20  CASH  pay $25.00 → change $3.80×4100 = 15 580 KHR
  (21.20, 'USD', 'CASH',  25.00, 0, 15580.00, NOW() - INTERVAL  '3 days'),
  -- order 4 : $16.80  KHQR
  (16.80, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL  '4 days'),
  -- order 5 : $31.40  CASH  pay $35.00 → change $3.60×4100 = 14 760 KHR
  (31.40, 'USD', 'CASH',  35.00, 0, 14760.00, NOW() - INTERVAL  '5 days'),
  -- order 6 : $33.50  KHQR
  (33.50, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL  '6 days'),
  -- order 7 : $11.50  CASH  pay $15.00 → change $3.50×4100 = 14 350 KHR
  (11.50, 'USD', 'CASH',  15.00, 0, 14350.00, NOW() - INTERVAL  '7 days'),
  -- order 8 : $29.50  KHQR
  (29.50, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL  '9 days'),
  -- order 9 : $14.20  CASH  pay $20.00 → change $5.80×4100 = 23 780 KHR
  (14.20, 'USD', 'CASH',  20.00, 0, 23780.00, NOW() - INTERVAL '10 days'),
  -- order 10: $9.80   KHQR
  ( 9.80, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL '11 days'),
  -- order 11: $22.50  CASH  pay $25.00 → change $2.50×4100 = 10 250 KHR
  (22.50, 'USD', 'CASH',  25.00, 0, 10250.00, NOW() - INTERVAL '12 days'),
  -- order 12: $15.50  KHQR
  (15.50, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL '14 days'),
  -- order 13: $7.70   CASH  pay $10.00 → change $2.30×4100 =  9 430 KHR
  ( 7.70, 'USD', 'CASH',  10.00, 0,  9430.00, NOW() - INTERVAL '15 days'),
  -- order 14: $60.80  KHQR
  (60.80, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL '17 days'),
  -- order 15: $15.90  CASH  pay $20.00 → change $4.10×4100 = 16 810 KHR
  (15.90, 'USD', 'CASH',  20.00, 0, 16810.00, NOW() - INTERVAL '18 days'),
  -- order 16: $12.50  KHQR
  (12.50, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL '19 days'),
  -- order 17: $37.75  CASH  pay $40.00 → change $2.25×4100 =  9 225 KHR
  (37.75, 'USD', 'CASH',  40.00, 0,  9225.00, NOW() - INTERVAL '21 days'),
  -- order 18: $5.50   KHQR
  ( 5.50, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL '23 days'),
  -- order 19: $22.00  CASH  pay $25.00 → change $3.00×4100 = 12 300 KHR
  (22.00, 'USD', 'CASH',  25.00, 0, 12300.00, NOW() - INTERVAL '25 days'),
  -- order 20: $85.70  KHQR
  (85.70, 'USD', 'KHQR',   0.00, 0,     0.00, NOW() - INTERVAL '28 days');

-- =============================================================================
-- ORDER ITEMS
-- price_at_sale mirrors the product price at time of sale
-- =============================================================================

INSERT INTO order_items (order_id, product_id, quantity, price_at_sale, currency) VALUES
  -- order 1 : Enfamil A+ Stage 1 ×1 = $18.50
  (1,  1, 1, 18.50, 'USD'),

  -- order 2 : MamyPoko Wipes 80s ×2 ($4.50) + Johnson's Shampoo ×1 ($3.20) = $7.70
  (2, 13, 2,  2.25, 'USD'),
  (2, 15, 1,  3.20, 'USD'),

  -- order 3 : Pampers XL ×1 ($14.20) + Huggies Wipes ×2 ($7.00) = $21.20
  (3,  9, 1, 14.20, 'USD'),
  (3, 12, 2,  3.50, 'USD'),

  -- order 4 : NAN OPTIPRO Stage 1 ×1 = $16.80
  (4,  4, 1, 16.80, 'USD'),

  -- order 5 : Similac GainPlus ×1 ($22.50) + Pigeon Bottle ×1 ($8.90) = $31.40
  (5,  3, 1, 22.50, 'USD'),
  (5, 17, 1,  8.90, 'USD'),

  -- order 6 : Enfamil Stage 2 ×1 ($17.90) + MamyPoko Pants ×1 ($11.50) + Dettol Wash ×1 ($4.10) = $33.50
  (6,  2, 1, 17.90, 'USD'),
  (6, 11, 1, 11.50, 'USD'),
  (6, 16, 1,  4.10, 'USD'),

  -- order 7 : MamyPoko Pants XL ×1 = $11.50
  (7, 11, 1, 11.50, 'USD'),

  -- order 8 : Similac GainPlus ×1 ($22.50) + NUK Soother ×1 ($5.50) + MamyPoko Wipes 40s ×1 ($1.50) = $29.50
  (8,  3, 1, 22.50, 'USD'),
  (8, 19, 1,  5.50, 'USD'),
  (8, 14, 1,  1.50, 'USD'),

  -- order 9 : Pampers XL ×1 = $14.20
  (9,  9, 1, 14.20, 'USD'),

  -- order 10: Mustela Gentle Cleanser ×1 = $9.80
  (10, 20, 1,  9.80, 'USD'),

  -- order 11: Similac GainPlus ×1 = $22.50
  (11,  3, 1, 22.50, 'USD'),

  -- order 12: Avent Bottle ×1 ($12.50) + MamyPoko Wipes 40s ×2 ($3.00) = $15.50
  (12, 18, 1, 12.50, 'USD'),
  (12, 14, 2,  1.50, 'USD'),

  -- order 13: MamyPoko Wipes 80s ×2 ($4.50) + Johnson's Shampoo ×1 ($3.20) = $7.70
  (13, 13, 2,  2.25, 'USD'),
  (13, 15, 1,  3.20, 'USD'),

  -- order 14: Enfamil Stage 1 ×1 ($18.50) + Similac ×1 ($22.50) + Pampers L ×1 ($12.80) + Huggies ×2 ($7.00) = $60.80
  (14,  1, 1, 18.50, 'USD'),
  (14,  3, 1, 22.50, 'USD'),
  (14, 10, 1, 12.80, 'USD'),
  (14, 12, 2,  3.50, 'USD'),

  -- order 15: Dumex Mamil Gold ×1 = $15.90
  (15,  5, 1, 15.90, 'USD'),

  -- order 16: Avent Bottle ×1 = $12.50
  (16, 18, 1, 12.50, 'USD'),

  -- order 17: NAN OPTIPRO ×1 ($16.80) + Pampers XL ×1 ($14.20) + MamyPoko Wipes 80s ×3 ($6.75) = $37.75
  (17,  4, 1, 16.80, 'USD'),
  (17,  9, 1, 14.20, 'USD'),
  (17, 13, 3,  2.25, 'USD'),

  -- order 18: NUK Soother ×1 = $5.50
  (18, 19, 1,  5.50, 'USD'),

  -- order 19: Enfamil Stage 2 ×1 ($17.90) + Dettol Wash ×1 ($4.10) = $22.00
  (19,  2, 1, 17.90, 'USD'),
  (19, 16, 1,  4.10, 'USD'),

  -- order 20: Enfamil Stage 1 ×2 ($37.00) + NAN OPTIPRO ×1 ($16.80) + MamyPoko Pants ×2 ($23.00) + Pigeon Bottle ×1 ($8.90) = $85.70
  (20,  1, 2, 18.50, 'USD'),
  (20,  4, 1, 16.80, 'USD'),
  (20, 11, 2, 11.50, 'USD'),
  (20, 17, 1,  8.90, 'USD');

COMMIT;
