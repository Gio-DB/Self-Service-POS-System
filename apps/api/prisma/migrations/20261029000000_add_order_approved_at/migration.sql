ALTER TABLE "orders"
ADD COLUMN "approved_at" TIMESTAMP(3);

UPDATE "orders"
SET "approved_at" = "updated_at"
WHERE "status" IN ('ACCEPTED', 'PREPARING', 'READY')
  AND "approved_at" IS NULL;

CREATE INDEX "orders_approved_at_idx" ON "orders"("approved_at");
