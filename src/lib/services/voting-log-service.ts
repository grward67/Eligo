import { prisma } from "@/lib/db";
import { getElectionActualDates } from "@/lib/services/election-dates-service";

export interface VotingLogCandidate {
  id: string;
  name: string;
  party: string | null;
}

export interface VotingLogBallot {
  /** Sequential position in submission order. Not the access code -- codes are never stored in
   * recoverable form, and a code-to-ranking table would let ballot secrecy be broken by anyone
   * who separately knows which code went to which person. */
  ballotNumber: number;
  ranking: string[];
}

export interface VotingLog {
  electionTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  candidates: VotingLogCandidate[];
  ballots: VotingLogBallot[];
}

/** Builds the data behind the "Voting log" PDF export (raw per-ballot rankings). */
export async function buildVotingLog(electionId: string): Promise<VotingLog | null> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { candidates: { orderBy: { sortOrder: "asc" } } },
  });

  if (!election) return null;

  const { startedAt, endedAt } = await getElectionActualDates(electionId);

  const ballots = await prisma.ballot.findMany({
    where: { electionId },
    orderBy: { submittedAt: "asc" },
  });

  return {
    electionTitle: election.title,
    startedAt,
    endedAt,
    candidates: election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party })),
    ballots: ballots.map((b, i) => ({
      ballotNumber: i + 1,
      ranking: JSON.parse(b.ranking) as string[],
    })),
  };
}
