ALTER TABLE "settings"
  ADD COLUMN "qr_payment_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "bank_bin" TEXT,
  ADD COLUMN "bank_account_number" TEXT,
  ADD COLUMN "bank_account_name" TEXT,
  ADD COLUMN "transfer_content_prefix" TEXT NOT NULL DEFAULT 'DH';
