ALTER TABLE "Election" ADD COLUMN "scheduledStartAt" TIMESTAMP(3);
ALTER TABLE "Election" ADD COLUMN "scheduledEndAt" TIMESTAMP(3);
ALTER TABLE "Election" ADD COLUMN "scheduleTimezone" TEXT;
