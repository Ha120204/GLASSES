ALTER TABLE "orders"
  ADD COLUMN "outstanding_amount" INTEGER NOT NULL DEFAULT 0;

UPDATE "orders" AS "order"
SET "outstanding_amount" = CASE
  WHEN "order"."status" = 'CANCELLED'::"OrderStatus" THEN 0
  ELSE GREATEST(
    0,
    "order"."total" - "order"."deposit" - COALESCE(
      (
        SELECT SUM(
          CASE
            WHEN "payment"."type" = 'PAYMENT'::"PaymentType" THEN "payment"."amount"
            ELSE -"payment"."amount"
          END
        )
        FROM "payments" AS "payment"
        WHERE "payment"."order_id" = "order"."id"
      ),
      0
    )
  )
END;

CREATE INDEX "orders_outstanding_amount_idx" ON "orders"("outstanding_amount");
