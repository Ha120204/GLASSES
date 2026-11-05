ALTER TABLE "products" ADD COLUMN "image_updated_at" TIMESTAMP(3);

CREATE TABLE "product_images" (
  "product_id" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "mime_type" TEXT NOT NULL,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_id")
);

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
