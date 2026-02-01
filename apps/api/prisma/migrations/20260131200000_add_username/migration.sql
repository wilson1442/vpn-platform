-- Add username column (nullable initially)
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill: set username to the part before @ in email, or full email
UPDATE "User" SET "username" = SPLIT_PART("email", '@', 1)
WHERE "username" IS NULL;

-- Ensure uniqueness by appending a suffix for duplicates
WITH duplicates AS (
  SELECT id, "username", ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt") as rn
  FROM "User"
)
UPDATE "User" SET "username" = "User"."username" || '_' || d.rn
FROM duplicates d
WHERE "User".id = d.id AND d.rn > 1;

-- Make username non-nullable and unique
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Make email nullable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
