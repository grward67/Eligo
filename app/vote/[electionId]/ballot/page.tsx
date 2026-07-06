import { redirect } from "next/navigation";
import { requireVoterSession } from "@/lib/auth/require-voter";
import { getActiveVoterSession } from "@/lib/services/ballot-service";
import { prisma } from "@/lib/db";
import { BallotForm } from "@/components/voter/ballot-form";
import "../../vote.css";

export default async function BallotPage({ params }: { params: { electionId: string } }) {
  const { electionId } = params;
  const voterSession = await requireVoterSession();

  if (!voterSession || voterSession.electionId !== electionId) {
    redirect(`/vote/${electionId}`);
  }

  const session = await getActiveVoterSession(voterSession.voterSessionId, electionId);
  if (!session) {
    redirect(`/vote/${electionId}`);
  }

  if (session.ballotSubmitted) {
    return (
      <main className="vote-shell">
        <div className="vote-card">
          <div className="vote-brand">
            <img src="/brand/logo.png" alt="Eligo" />
            <span>Eligo</span>
          </div>
          <h1>Thank you</h1>
          <p>Your ballot has already been recorded for this election.</p>
        </div>
      </main>
    );
  }

  const election = await prisma.election.findUnique({ where: { id: electionId } });

  if (!election || election.status !== "OPEN") {
    return (
      <main className="vote-shell">
        <div className="vote-card">
          <div className="vote-brand">
            <img src="/brand/logo.png" alt="Eligo" />
            <span>Eligo</span>
          </div>
          <h1>Voting closed</h1>
          <p>This election is not currently open for voting.</p>
        </div>
      </main>
    );
  }

  const candidates = await prisma.candidate.findMany({
    where: { electionId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <main className="vote-shell">
      <div className="vote-card">
        <div className="vote-brand">
          <img src="/brand/logo.png" alt="Eligo" />
          <span>Eligo</span>
        </div>
        <h1>{election.title}</h1>
        <p>Rank candidates in order of preference. Tap to rank; tap again to remove.</p>
        <BallotForm
          electionId={electionId}
          candidates={candidates.map((c) => ({ id: c.id, name: c.name, party: c.party }))}
        />
      </div>
    </main>
  );
}
