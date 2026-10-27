ALTER TABLE "stock_movements" ADD COLUMN "created_by_id" TEXT;

CREATE INDEX "stock_movements_created_by_id_idx" ON "stock_movements"("created_by_id");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
