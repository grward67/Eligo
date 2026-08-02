import { prisma } from "@/lib/db";

export interface ElectionActualDates {
  /** First time the election was set to OPEN, if ever. */
  startedAt: string | null;
  /** Most recent time the election was set to CLOSED, if ever. */
  endedAt: string | null;
}

/**
 * There's no dedicated "opened at" / "closed at" column on Election --
 * status changes are already recorded in the audit trail, so the actual
 * voting window is derived from there instead of adding a new column.
 */
export async function getElectionActualDates(electionId: string): Promise<ElectionActualDates> {
  const statusChanges = await prisma.auditLog.findMany({
    where: { targetType: "Election", targetId: electionId, action: "election.status_change" },
    orderBy: { createdAt: "asc" },
  });

  let startedAt: Date | null = null;
  let endedAt: Date | null = null;

  for (const log of statusChanges) {
    if (!log.metadata) continue;
    let status: unknown;
    try {
      status = JSON.parse(log.metadata).status;
    } catch {
      continue;
    }
    if (status === "OPEN" && !startedAt) {
      startedAt = log.createdAt;
    }
    if (status === "CLOSED") {
      endedAt = log.createdAt;
    }
  }

  return {
    startedAt: startedAt ? startedAt.toISOString() : null,
    endedAt: endedAt ? endedAt.toISOString() : null,
  };
}
