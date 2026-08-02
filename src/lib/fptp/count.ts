// Pure First Past the Post counting engine: whoever has the most votes
// wins, no rounds, no transfers. Deliberately has no dependency on and no
// shared code with the STV engine -- the two systems don't share counting
// logic, only the surrounding admin/voter infrastructure.

export interface FptpCandidateInput {
  id: string;
  name: string;
  party?: string | null;
}

export interface FptpBallotInput {
  /** Expected to contain exactly one candidate id; only the first entry is read. */
  ranking: string[];
}

export interface FptpTally {
  id: string;
  name: string;
  party: string | null;
  votes: number;
  status: "elected" | "not-elected";
}

export interface FptpResult {
  totalValidVotes: number;
  seats: number;
  /** Sorted descending by votes. Ties for the last seat are broken by candidate list order. */
  tallies: FptpTally[];
  winners: FptpCandidateInput[];
}

export class FptpValidationError extends Error {}

export function runFPTP(
  candidates: FptpCandidateInput[],
  seats: number,
  ballotsInput: FptpBallotInput[]
): FptpResult {
  if (candidates.length < 2) {
    throw new FptpValidationError("At least 2 candidates are required.");
  }
  if (!Number.isInteger(seats) || seats < 1) {
    throw new FptpValidationError("Seats must be a positive integer.");
  }
  if (seats >= candidates.length) {
    throw new FptpValidationError("Seats must be fewer than the number of candidates.");
  }

  const ballots = ballotsInput.filter((b) => b.ranking.length > 0);
  if (ballots.length === 0) {
    throw new FptpValidationError("No ballots have been cast.");
  }

  const votes: Record<string, number> = {};
  candidates.forEach((c) => {
    votes[c.id] = 0;
  });

  for (const b of ballots) {
    const choice = b.ranking[0];
    if (votes[choice] !== undefined) {
      votes[choice] += 1;
    }
  }

  // Stable sort: candidates.slice() preserves original list order, so ties
  // resolve deterministically by whoever was listed first.
  const ranked = candidates.slice().sort((a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0));
  const winnerIds = new Set(ranked.slice(0, seats).map((c) => c.id));

  const tallies: FptpTally[] = ranked.map((c) => ({
    id: c.id,
    name: c.name,
    party: c.party ?? null,
    votes: votes[c.id] ?? 0,
    status: winnerIds.has(c.id) ? "elected" : "not-elected",
  }));

  return {
    totalValidVotes: ballots.length,
    seats,
    tallies,
    winners: ranked.slice(0, seats).map((c) => ({ id: c.id, name: c.name, party: c.party })),
  };
}
