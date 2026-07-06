// Pure STV counting engine: Droop quota + Inclusive Gregory Method for
// surplus transfer. No imports from auth, db, or Next.js -- this module
// only knows about candidates, ballots, and arithmetic, so it can be
// unit tested and reused independently of how ballots were collected.

export interface StvCandidateInput {
  id: string;
  name: string;
  party?: string | null;
}

export interface StvBallotInput {
  ranking: string[];
}

export interface StvTally {
  id: string;
  name: string;
  party?: string | null;
  votes: number;
  status: "hopeful" | "elected" | "eliminated";
}

export interface StvRound {
  number: number;
  action: "elect" | "eliminate" | "elect-remaining";
  quota: number;
  tallies: StvTally[];
  note: string;
  exhausted: number;
  electedId?: string;
  electedIds?: string[];
  eliminatedId?: string;
  surplus?: number;
  transferValue?: number;
}

export interface StvResult {
  quota: number;
  totalValidVotes: number;
  seats: number;
  rounds: StvRound[];
  winners: StvCandidateInput[];
}

export class StvValidationError extends Error {}

interface WorkBallot {
  ranking: string[];
  value: number;
  pointer: number;
  currentCandidate: string | null;
  active: boolean;
}

export function runSTV(
  candidates: StvCandidateInput[],
  seats: number,
  ballotsInput: StvBallotInput[]
): StvResult {
  if (candidates.length < 2) {
    throw new StvValidationError("At least 2 candidates are required.");
  }
  if (!Number.isInteger(seats) || seats < 1) {
    throw new StvValidationError("Seats must be a positive integer.");
  }
  if (seats >= candidates.length) {
    throw new StvValidationError("Seats must be fewer than the number of candidates.");
  }

  const ballots = ballotsInput.filter((b) => b.ranking.length > 0);
  if (ballots.length === 0) {
    throw new StvValidationError("No ballots have been cast.");
  }

  const totalValidVotes = ballots.length;
  const quota = Math.floor(totalValidVotes / (seats + 1)) + 1;

  const status: Record<string, "hopeful" | "elected" | "eliminated"> = {};
  candidates.forEach((c) => {
    status[c.id] = "hopeful";
  });

  const work: WorkBallot[] = ballots.map((b) => ({
    ranking: b.ranking.slice(),
    value: 1,
    pointer: 0,
    currentCandidate: null,
    active: true,
  }));

  function assign(): { votes: Record<string, number>; exhausted: number } {
    const votes: Record<string, number> = {};
    candidates.forEach((c) => {
      votes[c.id] = 0;
    });
    let exhausted = 0;

    for (const b of work) {
      if (!b.active) continue;
      while (b.pointer < b.ranking.length) {
        const cid = b.ranking[b.pointer];
        if (status[cid] === "hopeful") {
          votes[cid] += b.value;
          b.currentCandidate = cid;
          break;
        }
        b.pointer++;
      }
      if (b.pointer >= b.ranking.length) {
        b.active = false;
        b.currentCandidate = null;
        exhausted += b.value;
      }
    }

    return { votes, exhausted };
  }

  const rounds: StvRound[] = [];
  const winners: StvCandidateInput[] = [];
  let seatsFilled = 0;
  let roundNum = 0;
  const maxRounds = candidates.length * 3 + 10;

  while (seatsFilled < seats && roundNum < maxRounds) {
    roundNum++;
    const { votes, exhausted } = assign();
    const hopefulIds = candidates.filter((c) => status[c.id] === "hopeful").map((c) => c.id);
    const remainingSeats = seats - seatsFilled;

    const tallies: StvTally[] = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      party: c.party ?? null,
      votes: votes[c.id] ?? 0,
      status: status[c.id],
    }));

    if (hopefulIds.length > 0 && hopefulIds.length <= remainingSeats) {
      hopefulIds.forEach((cid) => {
        status[cid] = "elected";
        const candidate = candidates.find((c) => c.id === cid);
        if (candidate) winners.push(candidate);
        seatsFilled++;
      });
      rounds.push({
        number: roundNum,
        action: "elect-remaining",
        quota,
        tallies,
        exhausted,
        electedIds: hopefulIds.slice(),
        note:
          `Only ${hopefulIds.length} hopeful candidate(s) remain for ${remainingSeats} open seat(s), so ` +
          `${hopefulIds.length === 1 ? "they are" : "all of them are"} declared elected without needing to reach the quota.`,
      });
      break;
    }

    const meetsQuota = hopefulIds.filter((cid) => (votes[cid] ?? 0) >= quota);

    if (meetsQuota.length > 0) {
      meetsQuota.sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0));
      const electId = meetsQuota[0];
      const total = votes[electId] ?? 0;
      const surplus = total - quota;
      status[electId] = "elected";
      const electedCandidate = candidates.find((c) => c.id === electId);
      if (electedCandidate) winners.push(electedCandidate);
      seatsFilled++;

      let transferValue: number | undefined;
      if (surplus > 1e-9 && seatsFilled < seats) {
        const factor = surplus / total;
        work.forEach((b) => {
          if (b.active && b.currentCandidate === electId) {
            b.value *= factor;
          }
        });
        transferValue = factor;
      }

      rounds.push({
        number: roundNum,
        action: "elect",
        quota,
        tallies,
        exhausted,
        electedId: electId,
        surplus,
        transferValue,
        note: buildElectNote(electedCandidate?.name ?? electId, total, quota, surplus, transferValue),
      });
      continue;
    }

    const sortedLow = hopefulIds.slice().sort((a, b) => (votes[a] ?? 0) - (votes[b] ?? 0));
    const elimId = sortedLow[0];
    status[elimId] = "eliminated";
    const elimCandidate = candidates.find((c) => c.id === elimId);

    rounds.push({
      number: roundNum,
      action: "eliminate",
      quota,
      tallies,
      exhausted,
      eliminatedId: elimId,
      note:
        `${elimCandidate?.name ?? elimId} has the fewest votes (${fmt(votes[elimId] ?? 0)}) and no candidate has ` +
        `reached the quota, so ${elimCandidate?.name ?? elimId} is eliminated. Their votes transfer to next preferences at unchanged value.`,
    });
  }

  return { quota, totalValidVotes, seats, rounds, winners };
}

function fmt(n: number): string {
  return (Math.round(n * 10000) / 10000).toString();
}

function buildElectNote(name: string, total: number, quota: number, surplus: number, transferValue?: number): string {
  let s = `${name} reaches the quota with ${fmt(total)} vote(s) (quota = ${quota}) and is elected.`;
  if (surplus > 1e-9) {
    s +=
      transferValue !== undefined
        ? ` Their surplus of ${fmt(surplus)} vote(s) is transferred to next preferences at a value of ${fmt(transferValue)} per ballot.`
        : ` Their surplus of ${fmt(surplus)} vote(s) is not transferred because all seats are now filled.`;
  } else {
    s += " There is no surplus to transfer.";
  }
  return s;
}
