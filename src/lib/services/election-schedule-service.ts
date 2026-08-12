import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * Flips a DRAFT election to OPEN once `scheduledStartAt` has passed, and an
 * OPEN election to CLOSED once `scheduledEndAt` has passed -- called from
 * every place that reads or enforces election status (voter verify/submit,
 * admin pages, PDF exports) instead of running as a background cron. Each
 * transition is recorded as a normal "election.status_change" audit entry
 * (actorType "system") backdated to the scheduled instant, so everything
 * downstream that derives "actual" start/end dates from the audit trail
 * keeps working unmodified and stays accurate to the scheduled time rather
 * than to whenever this happened to run.
 *
 * A no-op (one cheap read, no writes) for the vast majority of calls: any
 * election that has never used scheduling, or is already CLOSED.
 */
export async function applyDueScheduleTransitions(electionId: string): Promise<void> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.status === "CLOSED") return;
  if (!election.scheduledStartAt && !election.scheduledEndAt) return;

  const now = new Date();
  let status = election.status;

  if (status === "DRAFT" && election.scheduledStartAt && election.scheduledStartAt <= now) {
    await prisma.election.update({ where: { id: electionId }, data: { status: "OPEN" } });
    await writeAuditLog({
      actorType: "system",
      action: "election.status_change",
      targetType: "Election",
      targetId: electionId,
      metadata: { status: "OPEN", source: "schedule" },
      createdAt: election.scheduledStartAt,
    });
    status = "OPEN";
  }

  if (status === "OPEN" && election.scheduledEndAt && election.scheduledEndAt <= now) {
    await prisma.election.update({ where: { id: electionId }, data: { status: "CLOSED" } });
    await writeAuditLog({
      actorType: "system",
      action: "election.status_change",
      targetType: "Election",
      targetId: electionId,
      metadata: { status: "CLOSED", source: "schedule" },
      createdAt: election.scheduledEndAt,
    });
  }
}

export interface UpdateScheduleInput {
  /** undefined = leave the stored start alone (the only option once status is OPEN); null = clear it; Date = set it. Only honoured while status is DRAFT. */
  scheduledStartAt?: Date | null;
  scheduledEndAt: Date | null;
  scheduleTimezone: string | null;
}

export type UpdateScheduleResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "CLOSED" | "START_NOT_ALLOWED" | "END_IN_PAST" | "INVALID_RANGE" | "TIMEZONE_REQUIRED" | "INVALID_TIMEZONE" };

export async function updateSchedule(
  electionId: string,
  input: UpdateScheduleInput,
  updatedById: string
): Promise<UpdateScheduleResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return { ok: false, error: "NOT_FOUND" };
  if (election.status === "CLOSED") return { ok: false, error: "CLOSED" };

  if (election.status === "OPEN" && input.scheduledStartAt !== undefined) {
    return { ok: false, error: "START_NOT_ALLOWED" };
  }

  const now = new Date();
  if (input.scheduledEndAt && input.scheduledEndAt <= now) {
    return { ok: false, error: "END_IN_PAST" };
  }

  const effectiveStart = election.status === "DRAFT" ? (input.scheduledStartAt ?? null) : election.scheduledStartAt;
  if (effectiveStart && input.scheduledEndAt && input.scheduledEndAt <= effectiveStart) {
    return { ok: false, error: "INVALID_RANGE" };
  }

  const settingAnyDate = input.scheduledEndAt !== null || (election.status === "DRAFT" && input.scheduledStartAt);
  if (settingAnyDate) {
    if (!input.scheduleTimezone) return { ok: false, error: "TIMEZONE_REQUIRED" };
    if (!isValidTimeZone(input.scheduleTimezone)) return { ok: false, error: "INVALID_TIMEZONE" };
  }

  const data: { scheduledEndAt: Date | null; scheduleTimezone: string | null; scheduledStartAt?: Date | null } = {
    scheduledEndAt: input.scheduledEndAt,
    scheduleTimezone: input.scheduleTimezone,
  };
  if (election.status === "DRAFT") {
    data.scheduledStartAt = input.scheduledStartAt ?? null;
  }

  await prisma.election.update({ where: { id: electionId }, data });

  await writeAuditLog({
    actorType: "admin",
    actorId: updatedById,
    action: "election.schedule_change",
    targetType: "Election",
    targetId: electionId,
    metadata: {
      scheduledStartAt: data.scheduledStartAt !== undefined ? (data.scheduledStartAt?.toISOString() ?? null) : undefined,
      scheduledEndAt: data.scheduledEndAt?.toISOString() ?? null,
      scheduleTimezone: data.scheduleTimezone,
    },
  });

  return { ok: true };
}
