-- Restore the fulfilment workflow needed to manage made-to-order glasses.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'LENS_ORDERED', 'PROCESSING', 'READY', 'DELIVERED', 'CANCELLED');

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING "status"::text::"OrderStatus";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "OrderStatus_old";

CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");
CREATE INDEX "order_status_history_created_by_id_idx" ON "order_status_history"("created_by_id");

ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
