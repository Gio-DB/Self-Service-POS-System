# Restaurant Self-Service POS System – Project Plan & Engineering Requirements

## 1. Project Goal & Scope

**Goal:** Build a modular, self-hosted ordering and point-of-sale system for a restaurant, including:

- A self-service POS system that runs on the internal network and does not require internet access, except for remote customer support
- A touchscreen self-service kiosk
- Kitchen display system (KDS)
- An admin backend for menu, pricing, database administration, and reporting
- An out-of-order mode for maintenance

**Backlog:**

- PayPal payments
- Optional receipt printing or QR code for a digital receipt
- Customer ordering from an online menu, with orders sent to a waiter

## 1.1 Out of scope

- Payments using a mobile card reader such as SumUp

## 2. Hardware

| Component | MVP Recommendation | Premium Alternative | Notes |
|---|---|---|---|
| Kiosk display | 15.6" or 21.5" PCAP touchscreen, 400–700 nits | 21.5"–23.8" commercial kiosk display, 1000+ nits | Browser-based; no special hardware required |
| Kiosk display (lower-cost option) | Used Android tablet or a monitor connected to a Raspberry Pi | — | — |
| Kiosk computer | Raspberry Pi 5, 8 GB, or Intel NUC | Industrial mini PC, e.g. Advantech | Raspberry Pi is sufficient for the MVP; NUC is better for continuous operation |
| Kitchen display | Used Android tablet or a monitor connected to a Raspberry Pi | Dedicated KDS monitor | Browser-based; no special hardware required |
| Network | Wi-Fi router | --- | ---|

## 3. Key Points

These points are critical for production use:

1. **Offline first:** During a network outage, the kiosk must queue orders in browser storage (IndexedDB) and clearly tell customers that the restaurant has not yet received them. The kiosk synchronises queued orders when the connection returns.
2. **Real-time kitchen updates:** Use WebSocket push rather than polling. While online, an approved order should reach the kitchen display in less than one second.
3. **Menu synchronisation:** Sold-out items must disappear from the kiosk as soon as it receives an update.
4. **Idempotency:** Prevent duplicate orders caused by network retries, for example, by assigning a UUID to every order.
5. **Accessibility:** Provide sufficient contrast and large text.
6. **Operating modes:** Provide a "running" mode for normal operation and an "out-of-order" mode for maintenance.

## 4. General Capability

### Kiosk – Customer

- A menu with categories, images, prices, and allergen filters
- Modifiers, such as “extra cheese” or “no onions”
- Order type: takeaway or dine-in

### Kitchen Display – KDS

- A live list of open orders, sorted by arrival time
- Display the table number, when applicable
- Status buttons: “Not started,” “Preparing,” and “Ready”
- An audible alert when a new order arrives
- Filters by station, such as grill, salad, or drinks
- A primarily text-based interface
- Order modifications, such as “extra cheese” or “no onions,” appear in red

### Cash Register – Waiter / Staff

- Manual order entry as a fallback
- Cash payment processing and change calculation
- An end-of-day report, also known as a Z report

### Admin – Backend

- Menu management: items, categories, prices, modifiers
- Promotions and discounts
- Sales reports: revenue, top-selling items, hourly analysis
- User management and roles: admin, cashier, and kitchen
- Out-of-order mode

## 5. Concept of Operation

### Ordering Flow – Happy Path

```text
1. Customer starts at the kiosk. The menu is loaded from local cache or the API.
2. Customer selects items and modifiers. The cart is updated.
3. Customer selects “Takeaway” or “Dine-in”.
4. The customer submits the order. The system assigns it an ID and stores it in the database.
5. The waiter reviews the order in the order list.
6. The waiter can modify the order.
7. The waiter approves the order.
8. The kitchen display receives the order via WebSocket (only after The waiter approves the order).
9. Kitchen staff select “Preparing” and “Ready.” The status is sent to the cash register and the customer.
10. After the customer receives the prepared food, they pay the waiter.
11. The waiter records the order as “Paid.”
```

### Failure Cases – Degraded Mode

| Scenario | Behaviour |
|---|---|
| Network or server outage | The kiosk stores the order locally, displays “Your order is being processed,” and synchronises it later |
| Double tap on “Place order” | UUID-based idempotency prevents a duplicate order |

## 6. Operational Concept

### Roles and Permissions

| Role | Permissions |
|---|---|
| Admin | Manage the menu, prices, users, and reports; enable out-of-order mode |
| Cashier / Waiter | Accept orders, process cash payments, and cancel orders |
| Kitchen | View the KDS and update order statuses only |
| Customer | Place orders at the kiosk only |

### Maintenance and Support

- **Daily:** Automated database backup
- **Weekly:** Automated database backup, e.g., using `pg_dump` to a NAS
- **Monthly:** Software updates through staging and production, plus security patches
- **During an outage:** Remote access is allowed only when out-of-order mode is active

### Monitoring

- Health-check endpoint: `GET /health`
- Additional monitoring requirements to be defined

## 7. Software Architecture

### Layered Architecture

For the MVP, use one web app for the kiosk, kitchen display, and admin screens, backed by one API application and one PostgreSQL database on the restaurant network. Keep menu, order, and authentication code as modules in the same application rather than separate services or deployments.

```text
Kiosk ─────┐
KDS ───────┼── REST + WebSocket ──> One Node.js + Express API ──> PostgreSQL
Admin ─────┘

Kiosk browser: IndexedDB queue for orders waiting to sync
```

Use REST for menu, orders, and status changes. The single API instance can send KDS WebSocket updates directly; Redis Pub/Sub is unnecessary unless the app later runs multiple instances. Keep PostgreSQL as the authoritative store. The kiosk's IndexedDB queue is only for unsynced orders, not a second full database.

### Data Model

This starter schema covers menu categories and items, orders, and order lines. Generate order UUIDs on the kiosk so a retry uses the same ID and cannot create a duplicate. Store money as integer minor units to avoid rounding errors. Customizations are free-text notes only; this does not support price-changing modifiers or allergen filters. Define their rules and add the required fields or tables before offering those features.

```sql
CREATE TABLE menu_categories (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE menu_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES menu_categories(id),
    name TEXT NOT NULL,
    price_minor_units INTEGER NOT NULL CHECK (price_minor_units >= 0),
    is_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    order_type TEXT NOT NULL CHECK (order_type IN ('takeaway', 'dine_in')),
    table_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'accepted', 'preparing', 'ready', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    CHECK (
        (payment_status = 'unpaid' AND paid_at IS NULL)
        OR (payment_status = 'paid' AND paid_at IS NOT NULL)
    )
);

CREATE TABLE order_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_minor_units INTEGER NOT NULL CHECK (unit_price_minor_units >= 0),
    notes TEXT
);
```

The item name and unit price on each order line are snapshots, so later menu edits do not change past orders. This starter schema does not yet cover user/role management, promotions, structured modifiers, allergen filters, or detailed payment records. Define those requirements and extend the schema before implementing those capabilities; avoid adding generalized tables before their rules are clear.

### API Design

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/menu` | GET | Return available menu categories and items |
| `/api/menu/categories` | POST | Add a menu category (admin) |
| `/api/menu/items` | POST | Add a menu item (admin) |
| `/api/menu/items/:id` | PATCH | Update a menu item or mark it unavailable (admin) |
| `/api/orders` | POST | Create an order and its lines in one transaction; a client-generated UUID makes retries idempotent |
| `/api/orders/:id/status` | PATCH | Update the order status |
| `/api/orders/:id/payment-status` | PATCH | Record that a cash payment was received |
| `/api/reports/daily` | GET | Return a daily sales summary |
| `ws://server/kds` | WebSocket | Push accepted orders and status updates to the KDS |

Defer the payment-provider endpoint and integration until an online payment method is selected. Keep the MVP API to these straightforward operations; add endpoints only when a defined feature needs them.

Keep authentication in the same API application. Define basic access controls for admin routes before production; a separate auth service and a generalized permissions framework are not needed for the MVP.

### Offline Order Queue

1. If the API is unreachable, the kiosk stores the order in IndexedDB with status `pending_sync`.
2. When connectivity returns, the kiosk retries `POST /api/orders` using the same UUID.
3. Mark the local entry as synced only after the API confirms it has stored the order.
4. The KDS receives the order only after the server accepts it. Show queued orders to the customer as not yet received by the restaurant.

Do not add timestamp-based conflict resolution for the MVP. The server is authoritative after accepting an order; if a queued order cannot be synced, surface the problem for staff instead of silently treating it as accepted.

## 8. Recommended Tech Stack

| Component | Recommendation | Reason |
|---|---|---|
| Frontend | React, Tailwind CSS | A single client-side app is sufficient for the restaurant's internal screens; defer Next.js unless server-side rendering is needed |
| State management | React state; add Zustand only if shared state becomes difficult to manage | Avoid adding a state library before the UI needs it |
| Backend | Node.js, Express, TypeScript | Same language as the frontend |
| Local/offline storage | Browser IndexedDB | Store only the kiosk's pending-order queue |
| Database | PostgreSQL with Prisma | One authoritative database on the restaurant network |
| Real-time | Socket.io without Redis | A single API instance can push KDS updates directly; add Redis only if scaling to multiple instances |
