-- Keep the internal CUID for relations and give each exam a stable, readable code.
ALTER TABLE "eye_exams" ADD COLUMN "code" TEXT;
CREATE SEQUENCE "eye_exam_code_seq";

CREATE FUNCTION "next_eye_exam_code"() RETURNS TEXT AS $$
DECLARE
  code_prefix TEXT;
  next_number BIGINT;
  generated_code TEXT;
BEGIN
  SELECT COALESCE(NULLIF(upper(trim("invoice_template")), ''), 'PD')
  INTO code_prefix
  FROM "settings"
  ORDER BY "id"
  LIMIT 1;
  LOOP
    next_number := nextval('eye_exam_code_seq'::regclass);
    generated_code := COALESCE(code_prefix, 'PD') || '-' || lpad(next_number::text, GREATEST(length(next_number::text), 6), '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM "eye_exams" WHERE "code" = generated_code);
  END LOOP;
  RETURN generated_code;
END;
$$ LANGUAGE plpgsql;

-- Preserve the short code already shown on older printed exams.
WITH candidates AS (
  SELECT exam."id", row_number() OVER (ORDER BY exam."created_at", exam."id") AS number,
    COALESCE((SELECT NULLIF(upper(trim("invoice_template")), '') || '-' FROM "settings" ORDER BY "id" LIMIT 1), '') || upper(right(exam."id", 6)) AS legacy_code
  FROM "eye_exams" AS exam
), numbered AS (
  SELECT "id", number, legacy_code,
    row_number() OVER (PARTITION BY legacy_code ORDER BY number) AS duplicate_number
  FROM candidates
)
UPDATE "eye_exams" AS exam
SET "code" = CASE WHEN numbered.duplicate_number = 1 THEN numbered.legacy_code
  ELSE 'PD-LEG-' || lpad(numbered.number::text, GREATEST(length(numbered.number::text), 6), '0') END
FROM numbered
WHERE exam."id" = numbered."id";

SELECT setval(
  'eye_exam_code_seq',
  GREATEST((SELECT count(*) FROM "eye_exams"), 1),
  EXISTS (SELECT 1 FROM "eye_exams")
);

ALTER TABLE "eye_exams"
  ALTER COLUMN "code" SET NOT NULL,
  ALTER COLUMN "code" SET DEFAULT next_eye_exam_code();

CREATE UNIQUE INDEX "eye_exams_code_key" ON "eye_exams"("code");
