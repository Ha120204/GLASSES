ALTER TABLE "orders"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_hash" TEXT;

ALTER TABLE "payments"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_hash" TEXT;

CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
