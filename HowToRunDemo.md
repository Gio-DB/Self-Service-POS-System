To run the POS demo, open the repository in VS Code and use its integrated terminal from the project root.

### 1. Start PostgreSQL

On macOS, if you installed PostgreSQL with Homebrew:

```sh
brew services start postgresql@16
```

If you haven’t created the demo database role and database yet, run these once:

```sh
psql postgres -c "CREATE ROLE pos WITH LOGIN PASSWORD 'pos';"
psql postgres -c "CREATE DATABASE restaurant_pos OWNER pos;"
```

If the role or database already exists, skip those commands.

### 2. Install and configure the project

```sh
npm ci
cp .env.example .env
```

If you already have a `.env` file, keep it and check that its `DATABASE_URL` points to your local PostgreSQL database.

The prototype displays prices in EUR. The example file also configures Europe/Berlin as the business timezone and local demo PINs: waiter `1111`, kitchen `2222`, and admin `3333`. Replace the session secret and every PIN before any non-demo use. Order timestamps, daily order references, and the Admin daily summary use this configured timezone.

### 3. Set up and start the demo

```sh
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

Alternatively, in VS Code choose **Terminal → Run Task → Start POS Demo**.

### 4. Open the demo screens

- [Kiosk](http://127.0.0.1:5173/kiosk) — place an order and optionally enter a name or table number
- [Waiter station](http://127.0.0.1:5173/waiter) — sign in with the waiter PIN, review/edit/approve orders, mark ready orders served, and record cash payments in EUR
- [Kitchen display](http://127.0.0.1:5173/kds) — sign in with the kitchen PIN, view daily order references, and move orders through preparation
- [Admin and report](http://127.0.0.1:5173/admin) — manage item availability and shared role PINs, and view paid-sales totals. Existing PIN values are hidden.
- [API health](http://127.0.0.1:3000/health) — check that the API and database are connected

Keep `npm run dev` running while you use the demo. Press **Ctrl+C** in that terminal when finished. The app is for local demonstration only; shared PINs are not individual staff accounts, so don’t expose it to the public internet. First sign-in bootstraps the environment PINs as non-recoverable hashes. Admin PIN changes affect subsequent sign-ins; existing sessions remain active until expiry. See the `README setup guide` for more details.
