-- Create custom ENUM data types for tracking statuses
CREATE TYPE payment_method_enum AS ENUM ('CASH', 'KHQR');
CREATE TYPE order_status_enum AS ENUM ('COMPLETED', 'CANCELLED');
CREATE TYPE khqr_status_enum AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- 1. Customers Table (For Loyalty/Phone Number Lookup)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) UNIQUE, 
    loyalty_points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table (With Barcode tracking)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) UNIQUE NOT NULL, 
    price_usd DECIMAL(10, 2) NOT NULL, 
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Orders Table (Dual Currency Cash Tracking)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    total_amount_usd DECIMAL(10, 2) NOT NULL,
    payment_method payment_method_enum NOT NULL,
    amount_paid_usd DECIMAL(10, 2) DEFAULT 0.00,
    amount_paid_khr DECIMAL(10, 2) DEFAULT 0.00,
    change_given_khr DECIMAL(10, 2) DEFAULT 0.00, 
    status order_status_enum DEFAULT 'COMPLETED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. KHQR Transactions Table (For Bakong/Bank integration)
CREATE TABLE khqr_transactions (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    md5_hash VARCHAR(255) UNIQUE,         
    qr_string TEXT NOT NULL,              
    bank_name VARCHAR(100),               
    transaction_currency VARCHAR(3) DEFAULT 'USD',
    amount DECIMAL(10, 2) NOT NULL,
    status khqr_status_enum DEFAULT 'PENDING',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Order Items Table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    price_at_sale_usd DECIMAL(10, 2) NOT NULL
);

INSERT INTO products (name, barcode, price_usd, stock) VALUES
('Enfamil A+ Stage 1 (400g)', '884321678901', 18.50, 24),
('MamyPoko Wipes 80s', '885111112222', 2.25, 50),
('Pampers Pants XL 46s', '490243075631', 14.20, 15);