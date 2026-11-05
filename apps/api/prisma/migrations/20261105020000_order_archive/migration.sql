ALTER TYPE "OrderAuditAction" ADD VALUE 'ARCHIVED';
ALTER TYPE "OrderAuditAction" ADD VALUE 'RESTORED';

ALTER TABLE "orders"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_by_id" TEXT;

CREATE INDEX "orders_archived_at_created_at_idx" ON "orders"("archived_at", "created_at");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_archived_by_id_fkey"
  FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
