ALTER TABLE "orders"
DROP CONSTRAINT "orders_status_valid";

ALTER TABLE "orders"
ADD CONSTRAINT "orders_status_valid"
CHECK ("status" IN ('PENDING_REVIEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'));

CREATE TABLE "staff_credentials" (
    "role" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("role"),
    CONSTRAINT "staff_credentials_role_valid"
        CHECK ("role" IN ('WAITER', 'KITCHEN', 'ADMIN'))
);
