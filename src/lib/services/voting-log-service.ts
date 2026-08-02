import { prisma } from "@/lib/db";

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
  /** First time the election was set to OPEN, if ever. */
  startedAt: string | null;
  /** Most recent time the election was set to CLOSED, if ever. */
  endedAt: string | null;
  candidates: VotingLogCandidate[];
  ballots: VotingLogBallot[];
}

/** Builds the data behind the "Voting log" PDF export: derives the actual open/close times from the audit trail rather than from a dedicated column, since status changes are already recorded there. */
export async function buildVotingLog(electionId: string): Promise<VotingLog | null> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { candidates: { orderBy: { sortOrder: "asc" } } },
  });

  if (!election) return null;

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

  const ballots = await prisma.ballot.findMany({
    where: { electionId },
    orderBy: { submittedAt: "asc" },
  });

  return {
    electionTitle: election.title,
    startedAt: startedAt ? startedAt.toISOString() : null,
    endedAt: endedAt ? endedAt.toISOString() : null,
    candidates: election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party })),
    ballots: ballots.map((b, i) => ({
      ballotNumber: i + 1,
      ranking: JSON.parse(b.ranking) as string[],
    })),
  };
}
