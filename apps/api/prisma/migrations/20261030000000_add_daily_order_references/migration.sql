ALTER TABLE "orders"
RENAME COLUMN "table_number" TO "customer_reference";

ALTER TABLE "orders"
ADD COLUMN "business_date" DATE,
ADD COLUMN "order_number" INTEGER;

WITH numbered_orders AS (
    SELECT
        "id",
        "created_at"::date AS "business_date",
        ROW_NUMBER() OVER (
            PARTITION BY "created_at"::date
            ORDER BY "created_at", "id"
        ) AS "order_number"
    FROM "orders"
)
UPDATE "orders" AS orders
SET
    "business_date" = numbered_orders."business_date",
    "order_number" = numbered_orders."order_number"
FROM numbered_orders
WHERE orders."id" = numbered_orders."id";

ALTER TABLE "orders"
ALTER COLUMN "business_date" SET NOT NULL,
ALTER COLUMN "order_number" SET NOT NULL,
ADD CONSTRAINT "orders_order_number_range"
    CHECK ("order_number" BETWEEN 1 AND 99999);

CREATE UNIQUE INDEX "orders_business_date_order_number_key"
ON "orders"("business_date", "order_number");

CREATE TABLE "daily_order_counters" (
    "business_date" DATE NOT NULL,
    "last_number" INTEGER NOT NULL,
    CONSTRAINT "daily_order_counters_pkey" PRIMARY KEY ("business_date"),
    CONSTRAINT "daily_order_counters_last_number_range"
        CHECK ("last_number" BETWEEN 0 AND 99999)
);

INSERT INTO "daily_order_counters" ("business_date", "last_number")
SELECT "business_date", MAX("order_number")
FROM "orders"
GROUP BY "business_date";
