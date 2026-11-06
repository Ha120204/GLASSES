ALTER TABLE "orders"
  ADD COLUMN "refund_pending_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refund_method" "PaymentMethod",
  ADD COLUMN "refund_bank_name" TEXT,
  ADD COLUMN "refund_account_number" TEXT,
  ADD COLUMN "refund_account_name" TEXT;

ALTER TABLE "payments" ADD COLUMN "reference" TEXT;

CREATE INDEX "orders_refund_pending_amount_idx" ON "orders"("refund_pending_amount");
