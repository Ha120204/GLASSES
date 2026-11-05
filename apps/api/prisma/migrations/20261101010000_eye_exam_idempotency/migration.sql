ALTER TABLE "eye_exams"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_hash" TEXT;

CREATE UNIQUE INDEX "eye_exams_idempotency_key_key" ON "eye_exams"("idempotency_key");
