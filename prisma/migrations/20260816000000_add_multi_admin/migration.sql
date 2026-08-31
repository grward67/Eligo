-- Admin roles: every pre-existing admin becomes a product admin (there is
-- currently exactly one), so nothing about today's sole operator's access
-- changes. New signups default to ACCOUNT_ADMIN via the column default.
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ACCOUNT_ADMIN';
UPDATE "Admin" SET "role" = 'PRODUCT_ADMIN';

-- Election ownership: backfill every existing election to the earliest
-- (i.e. the original, sole) admin account, then make it required going
-- forward.
ALTER TABLE "Election" ADD COLUMN "createdById" TEXT;
UPDATE "Election" SET "createdById" = (SELECT "id" FROM "Admin" ORDER BY "createdAt" ASC LIMIT 1);
ALTER TABLE "Election" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "Election" ADD CONSTRAINT "Election_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Election_createdById_idx" ON "Election"("createdById");

-- Platform-wide policy singleton, seeded with the initial ballot quota.
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "ballotQuotaLimit" INTEGER NOT NULL DEFAULT 5,
    "ballotQuotaPeriodDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "ballotQuotaLimit", "ballotQuotaPeriodDays") VALUES ('singleton', 5, 30);
