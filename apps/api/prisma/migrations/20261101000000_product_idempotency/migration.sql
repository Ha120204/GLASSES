ALTER TABLE "products"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_hash" TEXT;

CREATE UNIQUE INDEX "products_idempotency_key_key" ON "products"("idempotency_key");
