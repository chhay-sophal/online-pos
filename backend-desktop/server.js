require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EXCHANGE_RATE = 4100;
const PORT = process.env.PORT || 5050;

// --- DATABASE SETUP ---

const DB_DIR = process.env.POS_DATA_DIR || path.join(os.homedir(), '.soso-babymart-pos');
const DB_PATH = path.join(DB_DIR, 'database.sqlite');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] ?? null;
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    barcode TEXT UNIQUE,
    price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    total_amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_method TEXT NOT NULL,
    bank_name TEXT,
    amount_paid_usd REAL DEFAULT 0,
    amount_paid_khr REAL DEFAULT 0,
    change_given_khr INTEGER DEFAULT 0,
    status TEXT DEFAULT 'COMPLETED',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL,
    currency TEXT DEFAULT 'USD'
  );
  CREATE TABLE IF NOT EXISTS store_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS khqr_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    md5_hash TEXT,
    qr_string TEXT,
    bank_name TEXT,
    transaction_currency TEXT,
    amount REAL,
    status TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO store_settings (key, value) VALUES
    ('exchange_rate', '4100'),
    ('locale', 'km'),
    ('main_currency', 'USD');
`;

// --- APP SETUP ---

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- ROUTES ---

app.get('/api/products/barcode/:barcode', (req, res) => {
  const rows = query(
    'SELECT id, name, barcode, price, currency, stock FROM products WHERE barcode = ?',
    [req.params.barcode]
  );
  if (!rows.length) return res.status(404).json({ message: 'Barcode not registered in system' });
  res.json(rows[0]);
});

app.get('/api/products', (req, res) => {
  res.json(query('SELECT * FROM products ORDER BY name ASC'));
});

app.post('/api/products', (req, res) => {
  const { name, barcode, price, cost_price, currency, stock } = req.body;
  try {
    const id = run(
      'INSERT INTO products (name, barcode, price, cost_price, currency, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, barcode, parseFloat(price), parseFloat(cost_price || 0), currency || 'USD', parseInt(stock) || 0]
    );
    saveDb();
    res.status(201).json(query('SELECT * FROM products WHERE id = ?', [id])[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  const { name, barcode, price, cost_price, currency, stock } = req.body;
  run(
    'UPDATE products SET name = ?, barcode = ?, price = ?, cost_price = ?, currency = ?, stock = ? WHERE id = ?',
    [name, barcode, parseFloat(price), parseFloat(cost_price || 0), currency || 'USD', parseInt(stock), req.params.id]
  );
  saveDb();
  const updated = query('SELECT * FROM products WHERE id = ?', [req.params.id])[0];
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

app.get('/api/settings', (req, res) => {
  const rows = query('SELECT key, value FROM store_settings');
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    run(
      'INSERT INTO store_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, String(value)]
    );
  }
  saveDb();
  res.json({ message: 'Settings saved' });
});

app.post('/api/orders/checkout', (req, res) => {
  const { customer_id, items, payment_method, bank_name, total_amount, amount_paid_usd, amount_paid_khr, khqr_data } = req.body;

  try {
    const totalPaidInUsd = parseFloat(amount_paid_usd || 0) + (parseFloat(amount_paid_khr || 0) / EXCHANGE_RATE);
    const changeInUsd = totalPaidInUsd - parseFloat(total_amount);
    const changeGivenKhr = changeInUsd > 0 ? Math.round(changeInUsd * EXCHANGE_RATE) : 0;

    const orderId = run(
      `INSERT INTO orders
        (customer_id, total_amount, currency, payment_method, bank_name, amount_paid_usd, amount_paid_khr, change_given_khr, status)
       VALUES (?, ?, 'USD', ?, ?, ?, ?, ?, 'COMPLETED')`,
      [customer_id || null, total_amount, payment_method, bank_name || null, amount_paid_usd, amount_paid_khr, changeGivenKhr]
    );

    for (const item of items) {
      run(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_sale, currency) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.id, item.quantity, item.price, item.currency || 'USD']
      );
      run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
    }

    if (payment_method === 'KHQR' && khqr_data) {
      run(
        `INSERT INTO khqr_transactions (order_id, md5_hash, qr_string, bank_name, transaction_currency, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS')`,
        [orderId, khqr_data.md5_hash, khqr_data.qr_string, khqr_data.bank_name || 'Bakong Network', khqr_data.currency, total_amount]
      );
    }

    saveDb();
    res.status(201).json({ message: 'Transaction completed', order_id: orderId, change_due_khr: changeGivenKhr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  const { date_from, date_to, payment_method } = req.query;
  const conditions = [];
  const params = [];

  if (date_from) { conditions.push('created_at >= ?'); params.push(date_from); }
  if (date_to)   { conditions.push('created_at < ?');  params.push(date_to); }
  if (payment_method && payment_method !== 'ALL') {
    conditions.push('payment_method = ?');
    params.push(payment_method);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orders = query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT 200`, params);

  const withItems = orders.map(order => {
    const items = query(
      `SELECT p.name as product_name, oi.quantity, oi.price_at_sale as price, oi.currency
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [order.id]
    );
    return { ...order, items };
  });

  res.json(withItems);
});

app.post('/api/payments/khqr', async (req, res) => {
  const { order_total_usd } = req.body;
  const amount = parseFloat(order_total_usd);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const settings = query('SELECT key, value FROM store_settings');
    const cfg = {};
    settings.forEach(r => { cfg[r.key] = r.value; });

    const { BakongKHQR, khqrData, IndividualInfo } = require('bakong-khqr');
    const now = Date.now();
    const individualInfo = new IndividualInfo(
      cfg.bakong_account_id || process.env.BAKONG_ACCOUNT_ID || '',
      cfg.bakong_merchant_name || process.env.BAKONG_MERCHANT_NAME || 'Baby Mart',
      cfg.bakong_merchant_city || process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
      { currency: khqrData.currency.usd, amount, expirationTimestamp: now + 5 * 60 * 1000 }
    );

    const khqrEngine = new BakongKHQR();
    const result = khqrEngine.generateIndividual(individualInfo);
    if (!result || result.status?.code !== 0) {
      return res.status(500).json({ error: 'Bakong SDK rejection', details: result?.status?.message });
    }

    res.json({ qr_string: result.data.qr, md5_hash: result.data.md5, amount, currency: 'USD' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/check-status/:md5_hash', async (req, res) => {
  const { md5_hash } = req.params;
  try {
    const tokenRow = query("SELECT value FROM store_settings WHERE key = 'bakong_api_token'")[0];
    const token = tokenRow?.value;
    const url = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
    const response = await axios.post(url, { md5: md5_hash }, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      timeout: 4000
    });
    if (response.data?.responseCode === 0) return res.json({ status: 'PAID', md5_hash });
    res.json({ status: 'PENDING', md5_hash });
  } catch (err) {
    res.status(500).json({ error: 'Communication error' });
  }
});

// --- STARTUP ---

async function start() {
  const initSqlJs = require('sql.js');

  // When running as a pkg binary the WASM lives in the virtual snapshot
  // filesystem, but WebAssembly.instantiate needs a real OS path.
  // Extract it to the OS temp dir once so the runtime can load it.
  let wasmDir;
  if (process.pkg) {
    const wasmSrc = path.join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
    const wasmDest = path.join(os.tmpdir(), 'sql-wasm.wasm');
    fs.writeFileSync(wasmDest, fs.readFileSync(wasmSrc));
    wasmDir = os.tmpdir();
  } else {
    wasmDir = path.join(__dirname, 'node_modules/sql.js/dist/');
  }

  const SQL = await initSqlJs({
    locateFile: file => path.join(wasmDir, file)
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log(`📂 Loaded database from ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log(`🆕 Created new database at ${DB_PATH}`);
  }

  db.run(SCHEMA);
  saveDb();

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ Desktop backend running on port ${PORT}`);
    console.log(`📁 Data: ${DB_PATH}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Kill the existing process with:\n   lsof -ti :${PORT} | xargs kill -9`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

start().catch(err => {
  console.error('Failed to start desktop backend:', err);
  process.exit(1);
});
