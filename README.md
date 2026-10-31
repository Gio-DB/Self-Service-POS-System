# Restaurant POS Demo

A local, browser-based prototype of a restaurant ordering flow. It has one React/Vite web app, one Express API, and one PostgreSQL database. The kiosk, waiter, kitchen display, and demo admin screens are routes in the same web app.

This is a development demo, not production POS software. The project plan and system requirements describe broader intended capabilities; this prototype does not implement all of them. It uses shared role PINs for local staff access, but has no individual accounts, persistent offline queue, payment provider, tax configuration, or production backup/security controls.

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
npm ci
cp .env.example .env
npm run db:migrate
npm run db:generate
npm run db:seed
```

The checked-in `.env.example` uses a local demo PostgreSQL URL, EUR display formatting, Europe/Berlin business-day boundaries and staff timestamps, and shared demo PINs. Change `DATABASE_URL`, `RESTAURANT_TIME_ZONE`, `STAFF_SESSION_SECRET`, and every `STAFF_*_PIN` in your untracked `.env` before first setup or any non-demo use. On first sign-in, the API stores the role PINs as non-recoverable hashes; thereafter, an administrator can replace all three in the Admin UI. Existing sessions remain valid until they expire.

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

Use separate tabs or windows to demonstrate the views. The waiter screen requires PIN `1111`, the kitchen display requires `2222`, and admin requires `3333` when using the example configuration. The waiter screen refreshes its five order sections periodically; the KDS receives server updates over Socket.IO.

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
2. In Waiter, enter the shared waiter PIN, review the five-digit order reference, modify item quantities or staff-only notes, and approve the order.
3. In Kitchen, move it through Preparing and Ready.
4. In Waiter, mark the ready order as served, then record cash tendered and verify change due.
5. In Admin, inspect the daily paid-sales summary, mark a menu item sold out, or replace all shared role PINs. Existing PIN values remain hidden.

Orders and payment states are stored in PostgreSQL. Re-submitting the same order ID and payload is idempotent; reusing the ID with a different payload is rejected.

## Current limitations

- Staff roles use shared PINs, not individual staff identities or production-grade account management. Do not expose this service to the public internet or use it for real transactions.
- Orders require a live API connection. Offline IndexedDB queueing is not implemented; disconnected orders are not restaurant-accepted.
- The KDS has no separate collection/clear action; ready orders stay visible until the next business day, then move to the archive.
- Waiter/KDS boards load the complete order history and partition it in memory. This is simple for the demo dataset; add bounded/paginated history before using it with a large production database.
- Prices are seeded demo values in integer euro cents. Tax rules and kitchen station assignment are not configured.
- The application has not been verified on Raspberry Pi/Ubuntu hardware. The Pi remains a later deployment target; no separate firmware is required.
- Staff accounts/user management, menu creation and price editing, out-of-order mode, and automated backups from the broader requirements are not implemented in this demo.

The demo implements connected kiosk ordering, waiter review/edit/approval, daily five-digit order references, KDS status progression, EUR cash payment recording, menu availability, and restaurant-timezone staff timestamps and daily sales summaries. Treat other requirements in the project plan and system requirements as planned or deferred unless this README explicitly identifies them as implemented.

See the [project plan](./restaurant_pos_project_plan_en.md) and [system requirements](./restaurant_pos_system_requirements.md) for broader intended scope and open decisions.
