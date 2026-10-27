-- The shop now sells directly from its product catalogue. Inventory movements,
-- fulfilment fields, and multi-step order statuses are no longer part of the model.
DROP TABLE "stock_movements";
DROP TABLE "order_status_history";

ALTER TABLE "products"
  DROP COLUMN "stock_qty",
  DROP COLUMN "min_stock";

ALTER TABLE "orders"
  DROP COLUMN "lab_name",
  DROP COLUMN "due_date";

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CANCELLED');

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING CASE WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'::"OrderStatus" ELSE 'NEW'::"OrderStatus" END;
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "OrderStatus_old";
DROP TYPE "StockMovementType";
