-- The store is operated by a single administrator role. Preserve users and
-- existing records by normalizing any legacy STAFF role before removing it.
UPDATE "users"
SET "role" = 'ADMIN'::"UserRole"
WHERE "role" = 'STAFF'::"UserRole";

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole"
  USING "role"::text::"UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN'::"UserRole";

DROP TYPE "UserRole_old";
