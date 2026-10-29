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
npm install
cp .env.example .env
```

If you already have a `.env` file, keep it and check that its `DATABASE_URL` points to your local PostgreSQL database.

### 3. Set up and start the demo

```sh
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

Alternatively, in VS Code choose **Terminal → Run Task → Start POS Demo**.

### 4. Open the demo screens

- [Kiosk](http://127.0.0.1:5173/kiosk) — place an order
- [Waiter station](http://127.0.0.1:5173/waiter) — review, edit, and approve orders; record cash payments
- [Kitchen display](http://127.0.0.1:5173/kds) — move orders through preparation
- [Admin and report](http://127.0.0.1:5173/admin) — manage item availability and view paid-sales totals
- [API health](http://127.0.0.1:3000/health) — check that the API and database are connected

Keep `npm run dev` running while you use the demo. Press **Ctrl+C** in that terminal when finished. The app is for local demonstration only; it has no staff authentication, so don’t expose it to the public internet. See the `README setup guide` for more details.