import { prisma } from "@/lib/db";
import { runSTV, StvValidationError } from "@/lib/stv/count";
import { runFPTP, FptpValidationError } from "@/lib/fptp/count";
import { getElectionActualDates } from "@/lib/services/election-dates-service";

export interface CountLogTally {
  name: string;
  party: string | null;
  votes: number;
  status: "hopeful" | "elected" | "eliminated";
}

export interface CountLogTransferIn {
  name: string;
  amount: number;
}

export interface CountLogRound {
  number: number;
  action: "elect" | "eliminate" | "elect-remaining";
  note: string;
  tallies: CountLogTally[];
  /** Votes transferred to each candidate as a direct result of this round's action. */
  transfersIn: CountLogTransferIn[];
  transferExhausted: number;
}

export interface FptpCountLogTally {
  name: string;
  party: string | null;
  votes: number;
  status: "elected" | "not-elected";
}

export interface ElectionCountLog {
  electionTitle: string;
  votingSystem: string;
  startedAt: string | null;
  endedAt: string | null;
  totalValidVotes: number;
  seats: number;
  winners: { name: string; party: string | null }[];
  /** STV only. */
  quota?: number;
  rounds?: CountLogRound[];
  /** FPTP only: final vote counts, no rounds or transfers. */
  tallies?: FptpCountLogTally[];
}

export type ElectionCountLogResult =
  | { ok: true; log: ElectionCountLog }
  | { ok: false; error: "NOT_FOUND" | "NO_BALLOTS" | "INVALID"; message?: string };

/** Builds the data behind the "Election count Log" PDF export. For STV this is the same round-by-round audit trail shown on the Results page plus a per-candidate transfer breakdown for each round; for FPTP it's just the final vote count per candidate. */
export async function buildElectionCountLog(electionId: string): Promise<ElectionCountLogResult> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { candidates: { orderBy: { sortOrder: "asc" } } },
  });
  if (!election) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const ballots = await prisma.ballot.findMany({ where: { electionId } });
  if (ballots.length === 0) {
    return { ok: false, error: "NO_BALLOTS" };
  }

  const { startedAt, endedAt } = await getElectionActualDates(electionId);

  if (election.votingSystem === "FPTP") {
    let result;
    try {
      result = runFPTP(
        election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party })),
        election.seats,
        ballots.map((b) => ({ ranking: JSON.parse(b.ranking) as string[] }))
      );
    } catch (err) {
      const message = err instanceof FptpValidationError ? err.message : "Could not compute results.";
      return { ok: false, error: "INVALID", message };
    }

    return {
      ok: true,
      log: {
        electionTitle: election.title,
        votingSystem: election.votingSystem,
        startedAt,
        endedAt,
        totalValidVotes: result.totalValidVotes,
        seats: result.seats,
        tallies: result.tallies.map((t) => ({
          name: t.name,
          party: t.party ?? null,
          votes: t.votes,
          status: t.status,
        })),
        winners: result.winners.map((w) => ({ name: w.name, party: w.party ?? null })),
      },
    };
  }

  let result;
  try {
    result = runSTV(
      election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party })),
      election.seats,
      ballots.map((b) => ({ ranking: JSON.parse(b.ranking) as string[] }))
    );
  } catch (err) {
    const message = err instanceof StvValidationError ? err.message : "Could not compute results.";
    return { ok: false, error: "INVALID", message };
  }

  const nameById = new Map(election.candidates.map((c) => [c.id, c.name]));

  return {
    ok: true,
    log: {
      electionTitle: election.title,
      votingSystem: election.votingSystem,
      startedAt,
      endedAt,
      quota: result.quota,
      totalValidVotes: result.totalValidVotes,
      seats: result.seats,
      rounds: result.rounds.map((r) => ({
        number: r.number,
        action: r.action,
        note: r.note,
        tallies: r.tallies.map((t) => ({
          name: t.name,
          party: t.party ?? null,
          votes: t.votes,
          status: t.status,
        })),
        transfersIn: Object.entries(r.transfersIn).map(([candidateId, amount]) => ({
          name: nameById.get(candidateId) ?? candidateId,
          amount,
        })),
        transferExhausted: r.transferExhausted,
      })),
      winners: result.winners.map((w) => ({ name: w.name, party: w.party ?? null })),
    },
  };
}
