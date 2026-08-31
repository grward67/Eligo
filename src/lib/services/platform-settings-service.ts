import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export interface PlatformSettingsValues {
  ballotQuotaLimit: number;
  ballotQuotaPeriodDays: number;
}

const DEFAULTS: PlatformSettingsValues = { ballotQuotaLimit: 5, ballotQuotaPeriodDays: 30 };

/** Falls back to sane defaults if the singleton row hasn't been created yet (e.g. a fresh database before the seed migration ran). */
export async function getPlatformSettings(): Promise<PlatformSettingsValues> {
  const row = await prisma.platformSettings.findFirst();
  return row ? { ballotQuotaLimit: row.ballotQuotaLimit, ballotQuotaPeriodDays: row.ballotQuotaPeriodDays } : DEFAULTS;
}

export interface UpdatePlatformSettingsResult {
  ok: boolean;
  error?: "INVALID_LIMIT" | "INVALID_PERIOD";
}

/** Product-admin-only: the one global policy every account admin's ballot quota is measured against. */
export async function updatePlatformSettings(input: PlatformSettingsValues, updatedById: string): Promise<UpdatePlatformSettingsResult> {
  if (!Number.isInteger(input.ballotQuotaLimit) || input.ballotQuotaLimit < 1) {
    return { ok: false, error: "INVALID_LIMIT" };
  }
  if (!Number.isInteger(input.ballotQuotaPeriodDays) || input.ballotQuotaPeriodDays < 1) {
    return { ok: false, error: "INVALID_PERIOD" };
  }

  const existing = await prisma.platformSettings.findFirst();
  if (existing) {
    await prisma.platformSettings.update({ where: { id: existing.id }, data: input });
  } else {
    await prisma.platformSettings.create({ data: input });
  }

  await writeAuditLog({
    actorType: "admin",
    actorId: updatedById,
    action: "platform_settings.change",
    metadata: { ...input },
  });

  return { ok: true };
}
