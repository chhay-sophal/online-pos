# SOSO POS

A Cambodia-specific point-of-sale desktop app with dual-currency support (USD + KHR) and Bakong KHQR payment integration.

## Features

- Barcode scanning — USB scanner or manual entry
- Dual-currency pricing — products priced in USD or KHR; totals shown in both
- Cash payment with change calculation (USD + KHR tendering)
- Bakong KHQR payment with real-time status polling
- Static QR (printed bank QR codes) with per-bank tracking
- Stock management — add, edit, bulk import (Excel/CSV), and export inventory
- Sales history with search, filter, sort, and date range
- Daily summary and low stock alerts
- Customer display window
- Per-order invoice with native print dialog
- Auto-update
- Khmer / English language toggle
- Configurable exchange rate and store settings

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, Vite, Tailwind CSS 4 |
| Backend | Node.js, Express 5 (Tauri sidecar) |
| Database | SQLite (via sql.js) |
| Payments | Bakong KHQR (NBC Cambodia) |
| Desktop shell | Tauri v2 |

---

## Installation

Download the latest installer from the [Releases](../../releases/latest) page.

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `.dmg` |
| Windows (x64) | `.exe` (NSIS installer) |

### macOS — "damaged and can't be opened"

After dragging the app to Applications, macOS may block it with:

> **"SOSO POS" is damaged and can't be opened. You should move it to the Trash.**

This is a Gatekeeper quarantine block on unsigned apps. Fix it by running this in Terminal:

```sh
xattr -cr /Applications/SOSO\ POS.app
```

Then open the app normally.

---

## Data Storage

All data is stored locally in a SQLite database:

| Platform | Path |
|---|---|
| macOS | `~/.soso-babymart-pos/database.sqlite` |
| Windows | `%USERPROFILE%\.soso-babymart-pos\database.sqlite` |

To **back up** your data, copy that file. To **reset** all data, delete it.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/)

### Run in dev mode

```sh
npm run tauri:dev
```

This starts the SQLite backend sidecar and the Tauri window with hot-reload. The first run compiles Rust dependencies (~5 minutes). Subsequent runs are fast.

### Build a local installer

```sh
npm run tauri:build
```

Output in `src-tauri/target/release/bundle/`.

---

## Releases (CI/CD)

Installers are built and published automatically by GitHub Actions on every version tag push.

```sh
git tag v1.2.6
git push origin v1.2.6
```

The workflow compiles the Node.js backend into a self-contained binary, bundles it as a Tauri sidecar, builds the installer for each platform, and attaches it to a GitHub Release.

---

## Project Structure

```
online-pos/
├── backend-desktop/        # Node.js/Express backend (SQLite, bundled as Tauri sidecar)
│   ├── server.js
│   └── package.json
├── frontend/               # React/Vite UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── StockManager.jsx        # inventory + bulk import/export
│   │   ├── SalesHistory.jsx
│   │   ├── SettingsManager.jsx
│   │   ├── Invoice.jsx             # print dialog
│   │   ├── CustomerDisplay.jsx
│   │   ├── DailySummary.jsx
│   │   └── locales.js              # km / en translations
│   └── Dockerfile
├── src-tauri/              # Tauri v2 shell
│   ├── src/lib.rs          # spawns backend sidecar on launch
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── icons/
├── .github/workflows/
│   └── tauri-build.yml     # CI: builds and publishes installers on tag push
└── package.json            # tauri:dev and tauri:build scripts
```

---

## First-time Setup

1. Open the app and go to **Settings**
2. Set your **Bakong account ID**, merchant name, and city
3. Adjust the **exchange rate** if needed (default: 1 USD = 4,100 KHR)
4. Add products via **Manage Inventory** — or bulk import from an Excel/CSV file
