CREATE TYPE "EyeExamAuditAction" AS ENUM ('CREATED', 'UPDATED', 'LOCKED', 'UNLOCKED', 'ARCHIVED', 'RESTORED');

ALTER TABLE "eye_exams"
  ADD COLUMN "locked_at" TIMESTAMP(3),
  ADD COLUMN "locked_by_id" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_by_id" TEXT;

CREATE INDEX "eye_exams_archived_at_idx" ON "eye_exams"("archived_at");

ALTER TABLE "eye_exams"
  ADD CONSTRAINT "eye_exams_locked_by_id_fkey"
  FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "eye_exams_archived_by_id_fkey"
  FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "eye_exam_audit_logs" (
  "id" TEXT NOT NULL,
  "eye_exam_id" TEXT NOT NULL,
  "action" "EyeExamAuditAction" NOT NULL,
  "changes" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,
  CONSTRAINT "eye_exam_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eye_exam_audit_logs_eye_exam_id_created_at_idx" ON "eye_exam_audit_logs"("eye_exam_id", "created_at");
CREATE INDEX "eye_exam_audit_logs_created_by_id_idx" ON "eye_exam_audit_logs"("created_by_id");

ALTER TABLE "eye_exam_audit_logs"
  ADD CONSTRAINT "eye_exam_audit_logs_eye_exam_id_fkey"
  FOREIGN KEY ("eye_exam_id") REFERENCES "eye_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "eye_exam_audit_logs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
