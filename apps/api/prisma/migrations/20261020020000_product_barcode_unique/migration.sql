UPDATE "products"
SET "barcode" = NULLIF(UPPER(BTRIM("barcode")), '');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "products"
    WHERE "barcode" IS NOT NULL
    GROUP BY "barcode"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Không thể tạo mã vạch duy nhất vì đang có mã vạch bị trùng.';
  END IF;
END $$;

CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
