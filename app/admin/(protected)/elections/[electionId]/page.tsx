import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CandidateForm } from "@/components/admin/candidate-form";
import { ElectionStatusControl } from "@/components/admin/election-status-control";
import { ElectionScheduleForm } from "@/components/admin/election-schedule-form";
import { PrSettingsForm } from "@/components/admin/pr-settings-form";
import { PartyListManager } from "@/components/admin/party-list-manager";
import { applyDueScheduleTransitions } from "@/lib/services/election-schedule-service";

export default async function ElectionDetailPage({ params }: { params: { electionId: string } }) {
  await applyDueScheduleTransitions(params.electionId);

  const election = await prisma.election.findUnique({
    where: { id: params.electionId },
    include: {
      candidates: { orderBy: { sortOrder: "asc" } },
      partyLists: { orderBy: { sortOrder: "asc" }, include: { candidates: { orderBy: { rank: "asc" } } } },
    },
  });

  if (!election) notFound();

  const status = election.status as "DRAFT" | "OPEN" | "CLOSED";

  return (
    <div>
      <h1>{election.title}</h1>
      <p>
        Seats: {election.seats} &middot; Status: {election.status}
      </p>
      <ElectionStatusControl electionId={election.id} status={election.status} />

      <nav className="election-subnav">
        <Link href={`/admin/elections/${election.id}/codes`}>Access codes</Link>
        <Link href={`/admin/elections/${election.id}/results`}>Results</Link>
      </nav>

      <h2>Automatic start/end (optional)</h2>
      <ElectionScheduleForm
        electionId={election.id}
        status={status}
        scheduledStartAt={election.scheduledStartAt?.toISOString() ?? null}
        scheduledEndAt={election.scheduledEndAt?.toISOString() ?? null}
        scheduleTimezone={election.scheduleTimezone}
      />

      {election.votingSystem === "PR" ? (
        <>
          <h2>Proportional representation settings</h2>
          <PrSettingsForm
            electionId={election.id}
            status={status}
            prThreshold={election.prThreshold}
            prCalculationMethod={election.prCalculationMethod as "DHONDT" | "SAINTE_LAGUE"}
            prAllowBlankVote={election.prAllowBlankVote}
          />

          <h2>Lists</h2>
          <PartyListManager electionId={election.id} status={status} seats={election.seats} lists={election.partyLists} />
        </>
      ) : (
        <>
          <h2>Candidates</h2>
          <ul>
            {election.candidates.map((c) => (
              <li key={c.id}>
                {c.name}
                {c.party ? ` (${c.party})` : ""}
              </li>
            ))}
          </ul>
          {status === "DRAFT" && <CandidateForm electionId={election.id} />}
        </>
      )}

      <p className="voter-link-hint">
        Voter link: <code>/vote/{election.id}</code>
      </p>
    </div>
  );
}
