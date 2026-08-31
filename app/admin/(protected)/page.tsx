import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { CreateElectionForm } from "@/components/admin/create-election-form";
import { ElectionsList } from "@/components/admin/elections-list";
import { applyDueScheduleTransitions } from "@/lib/services/election-schedule-service";
import { getElectionActualDates } from "@/lib/services/election-dates-service";
import { getBallotQuotaStatus } from "@/lib/services/quota-service";
import { formatInTimeZone } from "@/lib/timezone";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/admin/login");

  const isProductAdmin = session.role === "PRODUCT_ADMIN";
  const scope = isProductAdmin ? {} : { createdById: session.sub };

  const initial = await prisma.election.findMany({ where: scope, orderBy: { createdAt: "desc" } });
  await Promise.all(
    initial.filter((e) => e.status !== "CLOSED" && (e.scheduledStartAt || e.scheduledEndAt)).map((e) => applyDueScheduleTransitions(e.id))
  );

  const elections = await prisma.election.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { email: true } } },
  });

  const withSchedule = await Promise.all(
    elections.map(async (e) => {
      if (!e.scheduleTimezone) return { ...e, startLabel: null, endLabel: null };

      const { startedAt, endedAt } = await getElectionActualDates(e.id);
      const startLabel = startedAt
        ? formatInTimeZone(new Date(startedAt), e.scheduleTimezone)
        : e.scheduledStartAt
          ? `${formatInTimeZone(e.scheduledStartAt, e.scheduleTimezone)} (scheduled)`
          : null;
      const endLabel = endedAt
        ? formatInTimeZone(new Date(endedAt), e.scheduleTimezone)
        : e.scheduledEndAt
          ? `${formatInTimeZone(e.scheduledEndAt, e.scheduleTimezone)} (scheduled)`
          : null;

      return { ...e, startLabel, endLabel };
    })
  );

  const quota = isProductAdmin ? null : await getBallotQuotaStatus(session.sub);

  return (
    <div>
      <h1>Elections</h1>
      {quota && (
        <p className="quota-hint">
          {quota.used} of {quota.limit} ballot(s) used in the last {quota.periodDays} day(s).
        </p>
      )}
      <CreateElectionForm />
      <ElectionsList
        elections={withSchedule.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          votingSystem: e.votingSystem,
          startLabel: e.startLabel,
          endLabel: e.endLabel,
          ownerEmail: isProductAdmin ? e.createdBy.email : null,
        }))}
      />
    </div>
  );
}
