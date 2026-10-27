ALTER TABLE "orders" ADD COLUMN "created_by_id" TEXT;

CREATE INDEX "orders_created_by_id_idx" ON "orders"("created_by_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
