ALTER TABLE "orders" ADD COLUMN "due_date" DATE;
CREATE INDEX "orders_due_date_idx" ON "orders"("due_date");
