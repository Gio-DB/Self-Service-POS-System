CREATE TABLE "menu_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price_minor_units" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_type" TEXT NOT NULL,
    "table_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "total_minor_units" INTEGER NOT NULL,
    "cash_tendered_minor_units" INTEGER,
    "change_due_minor_units" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" INTEGER,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor_units" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "menu_categories_name_key" ON "menu_categories"("name");
CREATE UNIQUE INDEX "menu_items_category_id_name_key" ON "menu_items"("category_id", "name");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");
CREATE INDEX "orders_payment_status_paid_at_idx" ON "orders"("payment_status", "paid_at");
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

ALTER TABLE "menu_items"
ADD CONSTRAINT "menu_items_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_menu_item_id_fkey"
FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "menu_items"
ADD CONSTRAINT "menu_items_price_nonnegative" CHECK ("price_minor_units" >= 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_total_nonnegative" CHECK ("total_minor_units" >= 0),
ADD CONSTRAINT "orders_cash_values_nonnegative" CHECK (
    ("cash_tendered_minor_units" IS NULL OR "cash_tendered_minor_units" >= 0)
    AND ("change_due_minor_units" IS NULL OR "change_due_minor_units" >= 0)
);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
ADD CONSTRAINT "order_items_price_nonnegative" CHECK ("unit_price_minor_units" >= 0);
