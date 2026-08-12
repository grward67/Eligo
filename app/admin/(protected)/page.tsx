import { prisma } from "@/lib/db";
import { CreateElectionForm } from "@/components/admin/create-election-form";
import { ElectionsList } from "@/components/admin/elections-list";
import { applyDueScheduleTransitions } from "@/lib/services/election-schedule-service";
import { getElectionActualDates } from "@/lib/services/election-dates-service";
import { formatInTimeZone } from "@/lib/timezone";

export default async function AdminDashboardPage() {
  const initial = await prisma.election.findMany({ orderBy: { createdAt: "desc" } });
  await Promise.all(
    initial.filter((e) => e.status !== "CLOSED" && (e.scheduledStartAt || e.scheduledEndAt)).map((e) => applyDueScheduleTransitions(e.id))
  );

  const elections = await prisma.election.findMany({ orderBy: { createdAt: "desc" } });

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

  return (
    <div>
      <h1>Elections</h1>
      <CreateElectionForm />
      <ElectionsList
        elections={withSchedule.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          votingSystem: e.votingSystem,
          startLabel: e.startLabel,
          endLabel: e.endLabel,
        }))}
      />
    </div>
  );
}
