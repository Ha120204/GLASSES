-- A one-owner shop needs only an active order, a completed order, or a cancelled order.
-- Consolidate all legacy fulfilment stages while preserving every order and status-history row.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('IN_PROGRESS', 'DELIVERED', 'CANCELLED');

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING CASE
    WHEN "status"::text = 'DELIVERED' THEN 'DELIVERED'::"OrderStatus"
    WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'::"OrderStatus"
    ELSE 'IN_PROGRESS'::"OrderStatus"
  END;
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';

ALTER TABLE "order_status_history"
  ALTER COLUMN "from_status" TYPE "OrderStatus"
  USING CASE
    WHEN "from_status" IS NULL THEN NULL
    WHEN "from_status"::text = 'DELIVERED' THEN 'DELIVERED'::"OrderStatus"
    WHEN "from_status"::text = 'CANCELLED' THEN 'CANCELLED'::"OrderStatus"
    ELSE 'IN_PROGRESS'::"OrderStatus"
  END;
ALTER TABLE "order_status_history"
  ALTER COLUMN "to_status" TYPE "OrderStatus"
  USING CASE
    WHEN "to_status"::text = 'DELIVERED' THEN 'DELIVERED'::"OrderStatus"
    WHEN "to_status"::text = 'CANCELLED' THEN 'CANCELLED'::"OrderStatus"
    ELSE 'IN_PROGRESS'::"OrderStatus"
  END;

DROP TYPE "OrderStatus_old";
