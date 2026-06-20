import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import pkg from 'bakong-khqr';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
});

// Exchange rate helper (Standard Cambodia retail benchmark: $1 = 4,100 KHR)
const EXCHANGE_RATE = 4100;

// --- BACKGROUND WORKER: Automated Token Renewal Every 80 Days (Bakong tokens last 90 days, we renew at day 80 to be safe) ---
// Dynamic automated function to request a fresh token straight from the central bank ledger
async function autoRenewBakongToken() {
  try {
    // 1. Fetch the owner's registered email address from our dynamic settings table
    const emailResult = await pool.query("SELECT value FROM store_settings WHERE key = 'bakong_registered_email'");
    const registeredEmail = emailResult.rows[0]?.value;

    if (!registeredEmail) {
      console.error("❌ Token renewal aborted: No 'bakong_registered_email' set in database config.");
      return null;
    }

    console.log(`🔄 Requesting automated token rotation for: ${registeredEmail}`);

    // 2. Query the official NBC Open API token maintenance link
    const response = await axios.post('https://api-bakong.nbc.gov.kh/v1/renew_token', {
      email: registeredEmail
    });

    if (response.data && response.data.responseCode === 0) {
      const freshToken = response.data.data.token; // The new 90-day string token string
      
      // 3. Persist the fresh token into our settings table for immediate reuse
      await pool.query(
        "INSERT INTO store_settings (key, value) VALUES ('bakong_api_token', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [`Bearer ${freshToken}`]
      );

      console.log("💚 Token rotated successfully! Saved to PostgreSQL registry.");
      return `Bearer ${freshToken}`;
    }
  } catch (err) {
    console.error("❌ Critical exception during background token rotation:", err.message);
    return null;
  }
}

// --- API ENDPOINTS ---

// 1. SCANNER ENDPOINT: Fetch item immediately when barcode scanner inputs text
app.get('/api/products/barcode/:barcode', async (req, res) => {
  const { barcode } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, name, barcode, price_usd, stock FROM products WHERE barcode = $1', 
      [barcode]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Barcode not registered in system' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GENERATE OFFICIAL INDIVIDUAL KHQR (Tag 29 compliant using exact Class instantiation)
app.post('/api/payments/khqr', async (req, res) => {
  const { order_total_usd } = req.body;
  
  try {
    const amount = parseFloat(order_total_usd);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid total amount for QR creation' });
    }

    // Extract the classes and currency constants safely from the CommonJS default package export
    const { BakongKHQR, khqrData, IndividualInfo } = pkg;

    const nowInMs = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;

    const optionalData = {
        currency: khqrData.currency.usd, 
        amount: amount,
        expirationTimestamp: nowInMs + fiveMinutesInMs
    };

    /// Instantiate the configuration class exactly as the docs specify
    const individualInfo = new IndividualInfo(
      process.env.BAKONG_ACCOUNT_ID || '',
      process.env.BAKONG_MERCHANT_NAME || 'Baby Mart',
      process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
      optionalData
    );

    // Initialize the generator engine and pass the typed class structure instance
    const khqrEngine = new BakongKHQR();
    const khqrResponse = khqrEngine.generateIndividual(individualInfo);

    // If it still fails, log out the full request payload alongside the error so we can see the class state
    if (!khqrResponse || khqrResponse.status?.code !== 0) {
      console.error("Bakong SDK Full Response Error:", khqrResponse);
      console.error("Sent Payload Was:", {
        account: process.env.BAKONG_ACCOUNT_ID,
        optionalData
      });
      return res.status(500).json({ 
        error: "Bakong SDK rejection", 
        details: khqrResponse?.status?.message || "Internal library error"
      });
    }

    // Pass the valid dynamic transaction strings to the frontend React layout
    res.json({
      qr_string: khqrResponse.data.qr,
      md5_hash: khqrResponse.data.md5,
      amount: amount,
      currency: 'USD'
    });
  } catch (err) {
    console.error("Catch Block Exception Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2b. PRODUCTION CHECK LOOP: Query the Central Bank of Cambodia directly (with Detailed Debug Console logs)
app.get('/api/payments/check-status/:md5_hash', async (req, res) => {
  const { md5_hash } = req.params;

  try {
    // Grab whatever token is currently cached in the database settings
    let tokenResult = await pool.query("SELECT value FROM store_settings WHERE key = 'bakong_api_token'");
    let currentToken = tokenResult.rows[0]?.value;

    let targetUrl = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
    
    let response;
    try {
      response = await axios.post(targetUrl, { md5: md5_hash }, {
        headers: { 'Authorization': currentToken, 'Content-Type': 'application/json' },
        timeout: 4000
      });
    } catch (err) {
      // IF THE TOKEN EXPIRED, NBC RETURNS A 401 UNAUTHORIZED OR API CODE REJECTION
      if (err.response && (err.response.status === 401 || err.response.data?.responseCode === 6)) {
        console.log("⚠️ Token expiration detected live. Attempting immediate auto-renewal...");
        
        // Attempt rotation instantly
        const renewedToken = await autoRenewBakongToken();
        
        if (renewedToken) {
          // Retry the network lookup exactly once using the brand new token string
          response = await axios.post(targetUrl, { md5: md5_hash }, {
            headers: { 'Authorization': renewedToken, 'Content-Type': 'application/json' },
            timeout: 4000
          });
        } else {
          throw new Error("Automated authentication recovery failed");
        }
      } else {
        throw err; // Re-throw other non-token related errors (like network timeouts)
      }
    }

    // Process status response normally...
    if (response.data && response.data.responseCode === 0) {
      return res.json({ status: 'PAID', md5_hash });
    }
    res.json({ status: 'PENDING', md5_hash });

  } catch (err) {
    res.status(500).json({ error: "Communication breakdown" });
  }
});

// 3. IN-STORE CHECKOUT (Process transaction instantly at counter)
app.post('/api/orders/checkout', async (req, res) => {
  const { 
    customer_id, 
    items, 
    payment_method, 
    total_amount_usd, 
    amount_paid_usd, 
    amount_paid_khr,
    khqr_data 
  } = req.body;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Calculate Change given in KHR (Cambodian standard for retail)
    // Convert all inputs to USD values to find exact difference
    const totalPaidInUsd = parseFloat(amount_paid_usd || 0) + (parseFloat(amount_paid_khr || 0) / EXCHANGE_RATE);
    const changeInUsd = totalPaidInUsd - parseFloat(total_amount_usd);
    const changeGivenKhr = changeInUsd > 0 ? Math.round(changeInUsd * EXCHANGE_RATE) : 0;

    // 2. Record the Order
    const orderResult = await client.query(
      `INSERT INTO orders 
        (customer_id, total_amount_usd, payment_method, amount_paid_usd, amount_paid_khr, change_given_khr, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED') RETURNING id`,
      [customer_id || null, total_amount_usd, payment_method, amount_paid_usd, amount_paid_khr, changeGivenKhr]
    );
    const orderId = orderResult.rows[0].id;

    // 3. Loop items to snapshot sale price and reduce inventory stock
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_sale_usd) VALUES ($1, $2, $3, $4)',
        [orderId, item.id, item.quantity, item.price_usd]
      );

      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.id]
      );
    }

    // 4. If payment was KHQR, save the transaction reference mapping
    if (payment_method === 'KHQR' && khqr_data) {
      await client.query(
        `INSERT INTO khqr_transactions 
          (order_id, md5_hash, qr_string, bank_name, transaction_currency, amount, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS')`,
        [orderId, khqr_data.md5_hash, khqr_data.qr_string, khqr_data.bank_name || 'Bakong Network', khqr_data.currency, total_amount_usd]
      );
    }

    // 5. Update loyalty points if customer exists (e.g., 1 point per $1 spent)
    if (customer_id) {
      const pointsEarned = Math.floor(total_amount_usd);
      await client.query(
        'UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2',
        [pointsEarned, customer_id]
      );
    }

    await client.query('COMMIT');
    
    res.status(201).json({ 
      message: 'Transaction completed successfully', 
      order_id: orderId,
      change_due_khr: changeGivenKhr
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// --- SALES HISTORY ENDPOINT ---

app.get('/api/orders', async (req, res) => {
  const { date_from, date_to, payment_method } = req.query;

  const conditions = [];
  const params = [];

  if (date_from) { conditions.push(`o.created_at >= $${params.push(date_from)}`); }
  if (date_to)   { conditions.push(`o.created_at <  $${params.push(date_to)}`); }
  if (payment_method && payment_method !== 'ALL') {
    conditions.push(`o.payment_method = $${params.push(payment_method)}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.total_amount_usd,
        o.payment_method,
        o.amount_paid_usd,
        o.amount_paid_khr,
        o.change_given_khr,
        o.status,
        o.created_at,
        json_agg(
          json_build_object(
            'product_name', p.name,
            'quantity',     oi.quantity,
            'price_usd',    oi.price_at_sale_usd
          ) ORDER BY oi.id
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products     p  ON p.id = oi.product_id
      ${where}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 200
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales history:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// --- STOCK MANAGEMENT ENDPOINTS ---

// Fetch all products for the inventory sheet
app.get('/api/products', async (req, res) => {
  try {
    // Orders items by name so it's easy to look through alphabetically
    const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory list:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update an individual product's details (Stock level, Price, Name)
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, barcode, price_usd, stock } = req.body;

  try {
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, barcode = $2, price_usd = $3, stock = $4 
       WHERE id = $5 
       RETURNING *`,
      [name, barcode, parseFloat(price_usd), parseInt(stock), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log(`📦 Product ID ${id} updated in database. New Stock: ${stock}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating product metrics:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a brand new product to the shelves
app.post('/api/products', async (req, res) => {
  const { name, barcode, price_usd, price_khr, stock } = req.body;
  
  // Ensure strict numeric defaults are applied if one arrives undefined or empty
  const cleanUsd = price_usd ? parseFloat(price_usd) : 0.00;
  const cleanKhr = price_khr ? parseInt(price_khr, 10) : 0;

  try {
    const result = await db.query(
      `INSERT INTO products (name, barcode, price_usd, price_khr, stock) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, barcode, cleanUsd, cleanKhr, stock || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// --- STORE SETTINGS ENDPOINTS ---

// Fetch all system configurations
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store_settings');
    // Convert rows array into a clean key-value object e.g., { exchange_rate: '4100' }
    const settingsObj = {};
    result.rows.forEach(row => {
      settingsObj[row.key] = row.value;
    });
    res.json(settingsObj);
  } catch (err) {
    console.error('Error loading config rows:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update multiple settings at once
app.put('/api/settings', async (req, res) => {
  const settings = req.body; // Expects key-value pair map object
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        `INSERT INTO store_settings (key, value) 
         VALUES ($1, $2) 
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, String(value)]
      );
    }
    await client.query('COMMIT');
    console.log('⚙️ System configuration table updated successfully.');
    res.json({ message: 'Settings saved perfectly' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error committing setting adjustments:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`In-Store POS Backend active on port ${PORT}`));