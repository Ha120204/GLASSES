CREATE TYPE "PaymentType" AS ENUM ('PAYMENT', 'REFUND');
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN';

ALTER TABLE "orders"
  ADD COLUMN "cancellation_reason" TEXT,
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by_id" TEXT;

ALTER TABLE "payments"
  ADD COLUMN "type" "PaymentType" NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN "created_by_id" TEXT;

CREATE INDEX "payments_created_by_id_idx" ON "payments"("created_by_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_cancelled_by_id_fkey"
  FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
