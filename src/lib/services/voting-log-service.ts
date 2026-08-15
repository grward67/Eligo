import { prisma } from "@/lib/db";
import { getElectionActualDates } from "@/lib/services/election-dates-service";
import { PR_BLANK_VOTE_VALUE } from "@/lib/pr/count";

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
  votingSystem: string;
  startedAt: string | null;
  endedAt: string | null;
  /** For PR, one "candidate" column per list (id/name/party repurposed as listId/name/abbreviation), plus a synthetic "Blank vote" column if the election allows it. */
  candidates: VotingLogCandidate[];
  ballots: VotingLogBallot[];
}

/** Builds the data behind the "Voting log" PDF export (raw per-ballot rankings/choices). */
export async function buildVotingLog(electionId: string): Promise<VotingLog | null> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      candidates: { orderBy: { sortOrder: "asc" } },
      partyLists: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!election) return null;

  const { startedAt, endedAt } = await getElectionActualDates(electionId);

  const ballots = await prisma.ballot.findMany({
    where: { electionId },
    orderBy: { submittedAt: "asc" },
  });

  const candidates: VotingLogCandidate[] =
    election.votingSystem === "PR"
      ? [
          ...election.partyLists.map((l) => ({ id: l.id, name: l.name, party: l.abbreviation })),
          ...(election.prAllowBlankVote ? [{ id: PR_BLANK_VOTE_VALUE, name: "Blank vote", party: null }] : []),
        ]
      : election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party }));

  return {
    electionTitle: election.title,
    votingSystem: election.votingSystem,
    startedAt,
    endedAt,
    candidates,
    ballots: ballots.map((b, i) => ({
      ballotNumber: i + 1,
      ranking: JSON.parse(b.ranking) as string[],
    })),
  };
}
