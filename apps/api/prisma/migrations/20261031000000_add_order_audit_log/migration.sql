CREATE TYPE "OrderAuditAction" AS ENUM ('UPDATED');

CREATE TABLE "order_audit_logs" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "action" "OrderAuditAction" NOT NULL,
  "changes" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,
  CONSTRAINT "order_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_audit_logs_order_id_created_at_idx" ON "order_audit_logs"("order_id", "created_at");
CREATE INDEX "order_audit_logs_created_by_id_idx" ON "order_audit_logs"("created_by_id");

ALTER TABLE "order_audit_logs"
  ADD CONSTRAINT "order_audit_logs_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_audit_logs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
