ALTER TABLE "orders"
ADD CONSTRAINT "orders_type_valid"
CHECK ("order_type" IN ('TAKEAWAY', 'DINE_IN'));

ALTER TABLE "orders"
ADD CONSTRAINT "orders_status_valid"
CHECK ("status" IN ('PENDING_REVIEW', 'ACCEPTED', 'PREPARING', 'READY', 'CANCELLED'));

ALTER TABLE "orders"
ADD CONSTRAINT "orders_payment_status_valid"
CHECK ("payment_status" IN ('UNPAID', 'PAID'));

ALTER TABLE "orders"
ADD CONSTRAINT "orders_payment_values_consistent"
CHECK (
    (
        "payment_status" = 'UNPAID'
        AND "paid_at" IS NULL
        AND "cash_tendered_minor_units" IS NULL
        AND "change_due_minor_units" IS NULL
    )
    OR (
        "payment_status" = 'PAID'
        AND "paid_at" IS NOT NULL
        AND "cash_tendered_minor_units" IS NOT NULL
        AND "change_due_minor_units" IS NOT NULL
        AND "cash_tendered_minor_units" >= "total_minor_units"
        AND "change_due_minor_units" =
            "cash_tendered_minor_units" - "total_minor_units"
    )
);
