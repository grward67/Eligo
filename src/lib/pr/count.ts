/** Sentinel stored in Ballot.ranking[0] for a deliberate blank vote (only when the election allows it). */
export const PR_BLANK_VOTE_VALUE = "BLANK";

export type PrCalculationMethod = "DHONDT" | "SAINTE_LAGUE";

export interface PrCandidateInput {
  id: string;
  firstName: string;
  lastName: string;
  /** 1-based position on the list; rank 1 is first in line for a seat. */
  rank: number;
}

export interface PrListInput {
  id: string;
  name: string;
  abbreviation: string;
  candidates: PrCandidateInput[];
}

export interface PrBallotInput {
  /** Single-element: a PartyList id, or PR_BLANK_VOTE_VALUE. */
  ranking: string[];
}

export interface PrCandidateResult extends PrCandidateInput {
  status: "elected" | "not-elected";
}

export interface PrListResult {
  id: string;
  name: string;
  abbreviation: string;
  votes: number;
  /** Share of totalValidVotes, 0-100. */
  votePercent: number;
  excludedByThreshold: boolean;
  seatsWon: number;
  /** Theoretical proportional share (votePercent/100 * seats), unrounded -- the "raw" figure for the seats-won parenthetical. */
  idealSeats: number;
  candidates: PrCandidateResult[];
}

export interface PrTieBreak {
  /** Which seat number (1-based, in allocation order) this tie was for. */
  seatNumber: number;
  tiedListIds: string[];
  winnerId: string;
  method: "votes" | "random";
}

export interface PrResult {
  totalValidVotes: number;
  blankVotes: number;
  threshold: number;
  method: PrCalculationMethod;
  seats: number;
  lists: PrListResult[];
  tieBreaks: PrTieBreak[];
}

export class PrValidationError extends Error {}

const EPSILON = 1e-9;

export function runPR(
  lists: PrListInput[],
  seats: number,
  threshold: number,
  method: PrCalculationMethod,
  blankAllowed: boolean,
  ballotsInput: PrBallotInput[]
): PrResult {
  if (lists.length < 2) {
    throw new PrValidationError("At least 2 lists are required.");
  }
  if (!Number.isInteger(seats) || seats < 1) {
    throw new PrValidationError("Seats must be a positive integer.");
  }
  if (threshold < 0 || threshold > 100) {
    throw new PrValidationError("Threshold must be between 0 and 100.");
  }
  for (const list of lists) {
    if (list.candidates.length < seats) {
      throw new PrValidationError(`List "${list.name}" has fewer candidates than there are seats.`);
    }
  }

  const ballots = ballotsInput.filter((b) => b.ranking.length > 0);
  if (ballots.length === 0) {
    throw new PrValidationError("At least one ballot is required.");
  }

  const listIds = new Set(lists.map((l) => l.id));
  const voteCounts = new Map<string, number>(lists.map((l) => [l.id, 0]));
  let blankVotes = 0;

  for (const ballot of ballots) {
    const choice = ballot.ranking[0];
    if (blankAllowed && choice === PR_BLANK_VOTE_VALUE) {
      blankVotes++;
    } else if (listIds.has(choice)) {
      voteCounts.set(choice, (voteCounts.get(choice) ?? 0) + 1);
    }
  }

  const totalValidVotes = Array.from(voteCounts.values()).reduce((sum, v) => sum + v, 0);

  const excludedByThreshold = new Map<string, boolean>(
    lists.map((l) => [l.id, totalValidVotes > 0 && ((voteCounts.get(l.id) ?? 0) / totalValidVotes) * 100 < threshold])
  );

  const seatsWon = new Map<string, number>(lists.map((l) => [l.id, 0]));
  const tieBreaks: PrTieBreak[] = [];
  const eligible = lists.filter((l) => !excludedByThreshold.get(l.id));

  for (let seatNumber = 1; seatNumber <= seats && eligible.length > 0; seatNumber++) {
    const quotients = eligible.map((l) => {
      const won = seatsWon.get(l.id) ?? 0;
      const divisor = method === "DHONDT" ? won + 1 : 2 * won + 1;
      const votes = voteCounts.get(l.id) ?? 0;
      return { list: l, votes, quotient: votes / divisor };
    });

    const maxQuotient = Math.max(...quotients.map((q) => q.quotient));
    let tied = quotients.filter((q) => Math.abs(q.quotient - maxQuotient) < EPSILON);

    let winner = tied[0];
    if (tied.length > 1) {
      const maxVotes = Math.max(...tied.map((t) => t.votes));
      const votesTied = tied.filter((t) => Math.abs(t.votes - maxVotes) < EPSILON);
      if (votesTied.length > 1) {
        winner = votesTied[Math.floor(Math.random() * votesTied.length)];
        tieBreaks.push({ seatNumber, tiedListIds: tied.map((t) => t.list.id), winnerId: winner.list.id, method: "random" });
      } else {
        winner = votesTied[0];
        tieBreaks.push({ seatNumber, tiedListIds: tied.map((t) => t.list.id), winnerId: winner.list.id, method: "votes" });
      }
    }

    seatsWon.set(winner.list.id, (seatsWon.get(winner.list.id) ?? 0) + 1);
  }

  const listResults: PrListResult[] = lists.map((l) => {
    const votes = voteCounts.get(l.id) ?? 0;
    const votePercent = totalValidVotes > 0 ? (votes / totalValidVotes) * 100 : 0;
    const won = seatsWon.get(l.id) ?? 0;
    const rankedCandidates = l.candidates.slice().sort((a, b) => a.rank - b.rank);
    return {
      id: l.id,
      name: l.name,
      abbreviation: l.abbreviation,
      votes,
      votePercent,
      excludedByThreshold: excludedByThreshold.get(l.id) ?? false,
      seatsWon: won,
      idealSeats: totalValidVotes > 0 ? (votes / totalValidVotes) * seats : 0,
      candidates: rankedCandidates.map((c, i) => ({ ...c, status: i < won ? "elected" : "not-elected" })),
    };
  });

  return { totalValidVotes, blankVotes, threshold, method, seats, lists: listResults, tieBreaks };
}
