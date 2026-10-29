# Restaurant POS Demo

A local, browser-based prototype of a restaurant ordering flow. It has one React/Vite web app, one Express API, and one PostgreSQL database. The kiosk, waiter, kitchen display, and demo admin screens are routes in the same web app.

This is a development demo, not production POS software. It has no staff authentication, persistent offline queue, payment provider, tax configuration, or production backup/security controls. The role/screen routes are for local demonstration only.

## Requirements

- Node.js 22 LTS or newer and npm.
- PostgreSQL 16 or newer.
- VS Code (recommended) or another editor.
- A modern browser.

## Local setup (macOS)

Install and start PostgreSQL with Homebrew if it is not already available:

```sh
brew install postgresql@16
brew services start postgresql@16
```

Create a local demo role and database. If you already have a local database/role, instead adjust `DATABASE_URL` in `.env`:

```sh
psql postgres -c "CREATE ROLE pos WITH LOGIN PASSWORD 'pos';"
psql postgres -c "CREATE DATABASE restaurant_pos OWNER pos;"
```

From the repository root, install project packages, create local configuration, apply the schema, and seed the demo menu:

```sh
npm install
cp .env.example .env
npm run db:migrate
npm run db:generate
npm run db:seed
```

The checked-in `.env.example` uses a local demo PostgreSQL URL and GBP display formatting. Change `DATABASE_URL` and `VITE_CURRENCY` in your untracked `.env` if needed. The GBP setting is only a demo default; choose the restaurant's currency before using real prices.

Start the API and frontend together:

```sh
npm run dev
```

Or in VS Code, use **Terminal → Run Task → Start POS Demo**. Open:

- Kiosk: <http://127.0.0.1:5173/kiosk>
- Waiter: <http://127.0.0.1:5173/waiter>
- Kitchen display: <http://127.0.0.1:5173/kds>
- Admin/report: <http://127.0.0.1:5173/admin>
- API health: <http://127.0.0.1:3000/health>

Use separate tabs or windows to demonstrate the views. The waiter screen refreshes order lists periodically; the KDS receives server updates over Socket.IO. Admin has a demo sold-out toggle and daily paid-sales summary.

## Developer checks

```sh
npm test
npm run smoke # API and PostgreSQL must be running
npm run typecheck
npm run build
```

## Project structure

```text
apps/
  api/
    prisma/       schema, SQL migration, deterministic demo seed
    src/          API setup, routes, and focused order rules
  web/
    src/          API client, screens, formatting, and styles
.vscode/          VS Code run task
```

The API is deliberately one process with focused route and business-rule modules. There is no Redis, microservice layer, or deployment container in this prototype.

## Demo flow

1. Add menu items to the kiosk basket and submit a takeaway or dine-in order.
2. In Waiter, adjust item quantities and approve the order.
3. In Kitchen, move it through Preparing and Ready.
4. In Waiter, record cash tendered and verify change due.
5. In Admin, inspect the daily paid-sales summary or mark a menu item sold out.

Orders and payment states are stored in PostgreSQL. Re-submitting the same order ID and payload is idempotent; reusing the ID with a different payload is rejected.

## Current limitations

- Demo pages are not protected by authentication. Do not expose this service to the public internet or use it for real transactions.
- Orders require a live API connection. Offline IndexedDB queueing is not implemented; disconnected orders are not restaurant-accepted.
- Prices are seeded demo values in integer minor units. Currency/tax rules and kitchen station assignment are not configured.
- The application has not been verified on Raspberry Pi/Ubuntu hardware. The Pi remains a later deployment target; no separate firmware is required.

See the [project plan](./restaurant_pos_project_plan_en.md) and [system requirements](./restaurant_pos_system_requirements.md) for broader intended scope and open decisions.
