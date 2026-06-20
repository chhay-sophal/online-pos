# Point of Sale System

A Cambodia-specific POS system with dual-currency support (USD + KHR) and Bakong KHQR payment integration.

## Features

- Barcode scanning (USB scanner or manual entry)
- Dual-currency pricing — products can be priced in USD or KHR; totals shown in both
- Cash payment with change calculation (USD + KHR tendering)
- Bakong KHQR payment with real-time status polling
- Stock management — add, edit, and track inventory
- Sales history with search, filter, sort, and date range
- Excel export for stock and sales data
- Per-order PDF invoice generation
- Khmer / English language toggle
- Configurable exchange rate and store settings

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL 16 |
| Payments | Bakong KHQR (NBC Cambodia) |
| Serving | nginx (production) |
| Container | Docker + Docker Compose |

---

## Running with Docker (recommended)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Create the environment file

```bash
cp backend/.env.example backend/.env  # only needed for local dev
```

Create a root `.env` file for Docker:

```bash
echo "DB_PASSWORD=your_strong_password_here" > .env
```

### 2. Start the app

```bash
docker compose up -d
```

The app will be available at **http://localhost**.

The database is initialised automatically on first boot. All Bakong credentials are configured through the in-app Settings screen — no environment variables required.

### 3. Stop the app

```bash
docker compose down
```

> **Note:** `docker compose down` keeps your data. To wipe the database too, run `docker compose down -v`.

---

## Running for Local Development

### Prerequisites

- Node.js 22+
- PostgreSQL running locally

### Backend

```bash
cd backend
cp .env.example .env   # fill in your local DB credentials
npm install
npm run dev            # starts on http://localhost:5050
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

---

## Docker Hub Images

Pre-built images are published at:

- `chhaysophal/online-pos-backend:latest`
- `chhaysophal/online-pos-frontend:latest`

### Deploying to a server

Copy `docker-compose.yml` and `.env` to the server, then:

```bash
docker compose pull
docker compose up -d
```

### Building and publishing a new version

```bash
docker compose build
docker compose push
```

---

## Project Structure

```
online-pos/
├── backend/
│   ├── server.js          # Express API
│   ├── sql/
│   │   ├── 001_initial_schema.sql   # schema + default settings
│   │   └── 002_seed_mock_data.sql   # demo data (dev only)
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # register / checkout
│   │   ├── StockManager.jsx
│   │   ├── SalesHistory.jsx
│   │   ├── SettingsManager.jsx
│   │   ├── Invoice.jsx
│   │   └── locales.js       # km / en translations
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── .env                   # DB_PASSWORD (gitignored)
```

---

## First-time Setup After Deployment

1. Open the app and go to **Settings**
2. Set your **Bakong account ID**, merchant name, and city
3. Adjust the **exchange rate** if needed (default: 1 USD = 4,100 KHR)
4. Add your products via **Manage Inventory**

## Database Backup

```bash
docker exec online-pos-postgres-1 pg_dump -U pos posdb > backup_$(date +%Y%m%d).sql
```
