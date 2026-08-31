import { prisma } from "@/lib/db";
import { getPlatformSettings } from "@/lib/services/platform-settings-service";

export interface BallotQuotaStatus {
  limit: number;
  periodDays: number;
  used: number;
  remaining: number;
  exceeded: boolean;
}

/**
 * How many elections `adminId` has created within the trailing quota
 * window. Counted from the audit log's "election.create" entries rather
 * than the Election table itself, so a deleted election still counts --
 * otherwise create-then-delete would let an account admin dodge the limit
 * indefinitely. Meaningful only for account admins; product admins are
 * unlimited and should never call this.
 */
export async function getBallotQuotaStatus(adminId: string): Promise<BallotQuotaStatus> {
  const { ballotQuotaLimit, ballotQuotaPeriodDays } = await getPlatformSettings();
  const windowStart = new Date(Date.now() - ballotQuotaPeriodDays * 24 * 60 * 60 * 1000);

  const used = await prisma.auditLog.count({
    where: { action: "election.create", actorId: adminId, createdAt: { gte: windowStart } },
  });

  return {
    limit: ballotQuotaLimit,
    periodDays: ballotQuotaPeriodDays,
    used,
    remaining: Math.max(0, ballotQuotaLimit - used),
    exceeded: used >= ballotQuotaLimit,
  };
}
