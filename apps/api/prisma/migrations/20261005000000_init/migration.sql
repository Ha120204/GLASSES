CREATE TYPE "ProductType" AS ENUM ('FRAME', 'LENS', 'CONTACT', 'ACCESSORY');
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'LENS_ORDERED', 'PROCESSING', 'READY', 'DELIVERED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "birthday" DATE,
  "gender" TEXT,
  "address" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

CREATE TABLE "eye_exams" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "exam_date" DATE NOT NULL,
  "examiner" TEXT,
  "r_sph" TEXT, "r_cyl" TEXT, "r_axis" TEXT, "r_add" TEXT, "r_pd" TEXT,
  "l_sph" TEXT, "l_cyl" TEXT, "l_axis" TEXT, "l_add" TEXT, "l_pd" TEXT,
  "note" TEXT,
  "next_reminder_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eye_exams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eye_exams_next_reminder_date_idx" ON "eye_exams"("next_reminder_date");

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "barcode" TEXT,
  "name" TEXT NOT NULL,
  "type" "ProductType" NOT NULL,
  "brand" TEXT,
  "cost_price" INTEGER NOT NULL,
  "sale_price" INTEGER NOT NULL,
  "stock_qty" INTEGER NOT NULL DEFAULT 0,
  "min_stock" INTEGER NOT NULL DEFAULT 0,
  "supplier" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "eye_exam_id" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
  "subtotal" INTEGER NOT NULL,
  "discount" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "deposit" INTEGER NOT NULL DEFAULT 0,
  "due_date" DATE,
  "warranty_until" DATE,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "qty" INTEGER NOT NULL,
  "order_id" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "product_id" TEXT,
  "name" TEXT NOT NULL,
  "unit_price" INTEGER NOT NULL,
  "qty" INTEGER NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
  "id" TEXT NOT NULL,
  "store_name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "invoice_template" TEXT,
  "reminder_months" INTEGER NOT NULL DEFAULT 12,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "eye_exams" ADD CONSTRAINT "eye_exams_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_eye_exam_id_fkey" FOREIGN KEY ("eye_exam_id") REFERENCES "eye_exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
