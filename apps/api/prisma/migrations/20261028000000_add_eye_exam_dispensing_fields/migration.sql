ALTER TABLE "eye_exams"
  ADD COLUMN "pd_total" DECIMAL(5,2),
  ADD COLUMN "wearing_purpose" TEXT,
  ADD COLUMN "lens_design" TEXT,
  ADD COLUMN "no_prescription" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "no_prescription_reason" TEXT;
