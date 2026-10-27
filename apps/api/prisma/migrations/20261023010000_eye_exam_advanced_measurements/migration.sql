ALTER TABLE "eye_exams"
  ADD COLUMN "r_prism" DECIMAL(4,2),
  ADD COLUMN "r_base" VARCHAR(2),
  ADD COLUMN "r_seg_height" DECIMAL(4,1),
  ADD COLUMN "l_prism" DECIMAL(4,2),
  ADD COLUMN "l_base" VARCHAR(2),
  ADD COLUMN "l_seg_height" DECIMAL(4,1);
