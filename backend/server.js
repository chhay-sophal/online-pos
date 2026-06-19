import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
// import {KHQR, khqrData, IndividualInfo, MerchantInfo, SourceInfo} from 'bakong-khqr';
// import BakongKHQR from 'bakong-khqr';
// const {
// BakongKHQR,
// khqrData,
// IndividualInfo,
// MerchantInfo,
// } = require("bakong-khqr");

// const bakongKhqr = new KHQR();

import pkg from 'bakong-khqr';
// const { BakongKHQR } = pkg; // Extract the core class safely

// Create your class instance
// const khqrInstance = new BakongKHQR();

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`In-Store POS Backend active on port ${PORT}`));