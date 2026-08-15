import { describe, it, expect } from "vitest";
import { runPR, PrValidationError, PR_BLANK_VOTE_VALUE, type PrListInput, type PrBallotInput } from "./count";

function candidates(listId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${listId}c${i + 1}`,
    firstName: `First${i + 1}`,
    lastName: `${listId}Last`,
    rank: i + 1,
  }));
}

function ballotsFor(choice: string, count: number): PrBallotInput[] {
  return Array.from({ length: count }, () => ({ ranking: [choice] }));
}

describe("runPR", () => {
  it("allocates seats by D'Hondt, favoring the largest list more than Sainte-Laguë would", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 3) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 3) },
      { id: "C", name: "Gamma", abbreviation: "C", candidates: candidates("C", 3) },
    ];
    const ballots = [...ballotsFor("A", 10), ...ballotsFor("B", 6), ...ballotsFor("C", 4)];

    const result = runPR(lists, 3, 0, "DHONDT", false, ballots);

    expect(result.totalValidVotes).toBe(20);
    const seatsById = Object.fromEntries(result.lists.map((l) => [l.id, l.seatsWon]));
    expect(seatsById).toEqual({ A: 2, B: 1, C: 0 });

    const alpha = result.lists.find((l) => l.id === "A")!;
    expect(alpha.idealSeats).toBeCloseTo(1.5);
    expect(alpha.votePercent).toBeCloseTo(50);
  });

  it("allocates seats by Sainte-Lague, giving the smallest list a seat D'Hondt would not", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 3) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 3) },
      { id: "C", name: "Gamma", abbreviation: "C", candidates: candidates("C", 3) },
    ];
    const ballots = [...ballotsFor("A", 10), ...ballotsFor("B", 6), ...ballotsFor("C", 4)];

    const result = runPR(lists, 3, 0, "SAINTE_LAGUE", false, ballots);

    const seatsById = Object.fromEntries(result.lists.map((l) => [l.id, l.seatsWon]));
    expect(seatsById).toEqual({ A: 1, B: 1, C: 1 });
  });

  it("excludes a list below the electoral threshold from seat allocation", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 3) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 3) },
      { id: "C", name: "Gamma", abbreviation: "C", candidates: candidates("C", 3) },
    ];
    // C has 4/100 = 4% of the vote, below a 5% threshold -- excluded even though it would
    // otherwise have picked up the last seat under a plain D'Hondt count.
    const ballots = [...ballotsFor("A", 50), ...ballotsFor("B", 46), ...ballotsFor("C", 4)];

    const result = runPR(lists, 3, 5, "DHONDT", false, ballots);

    const gamma = result.lists.find((l) => l.id === "C")!;
    expect(gamma.excludedByThreshold).toBe(true);
    expect(gamma.seatsWon).toBe(0);
    expect(gamma.votes).toBe(4);
    const totalSeats = result.lists.reduce((sum, l) => sum + l.seatsWon, 0);
    expect(totalSeats).toBe(3);
  });

  it("counts blank votes separately and excludes them from valid-vote totals and percentages", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 2) },
    ];
    const ballots = [...ballotsFor("A", 6), ...ballotsFor("B", 4), ...ballotsFor(PR_BLANK_VOTE_VALUE, 5)];

    const result = runPR(lists, 2, 0, "DHONDT", true, ballots);

    expect(result.blankVotes).toBe(5);
    expect(result.totalValidVotes).toBe(10);
    const alpha = result.lists.find((l) => l.id === "A")!;
    expect(alpha.votePercent).toBeCloseTo(60);
  });

  it("ignores blank-marked ballots as votes when blank voting isn't allowed for the election", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 2) },
    ];
    // Ballot service would never store one of these when blank voting is disallowed;
    // the engine defensively treats a stray one as neither a blank nor a valid vote.
    const ballots = [...ballotsFor("A", 6), ...ballotsFor("B", 4), ...ballotsFor(PR_BLANK_VOTE_VALUE, 5)];

    const result = runPR(lists, 2, 0, "DHONDT", false, ballots);

    expect(result.blankVotes).toBe(0);
    expect(result.totalValidVotes).toBe(10);
  });

  it("translates seats won into elected candidates by rank order", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 3) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 3) },
    ];
    const ballots = [...ballotsFor("A", 10), ...ballotsFor("B", 4)];

    const result = runPR(lists, 3, 0, "DHONDT", false, ballots);

    const alpha = result.lists.find((l) => l.id === "A")!;
    expect(alpha.seatsWon).toBe(2);
    expect(alpha.candidates.map((c) => c.status)).toEqual(["elected", "elected", "not-elected"]);
    expect(alpha.candidates[0].rank).toBe(1);
    expect(alpha.candidates[2].rank).toBe(3);
  });

  it("breaks a quotient tie in favor of the list with more total votes, and logs it", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 2) },
    ];
    // Round 1: A(12) beats B(6), A wins seat 1. Round 2: A/2=6 ties B/1=6 -- A has
    // more total votes, so A wins the tie-break for seat 2.
    const ballots = [...ballotsFor("A", 12), ...ballotsFor("B", 6)];

    const result = runPR(lists, 2, 0, "DHONDT", false, ballots);

    const seatsById = Object.fromEntries(result.lists.map((l) => [l.id, l.seatsWon]));
    expect(seatsById).toEqual({ A: 2, B: 0 });
    expect(result.tieBreaks).toEqual([{ seatNumber: 2, tiedListIds: ["A", "B"], winnerId: "A", method: "votes" }]);
  });

  it("falls back to a random, logged tie-break when quotient and vote totals are both tied", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 1) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 1) },
    ];
    const ballots = [...ballotsFor("A", 6), ...ballotsFor("B", 6)];

    const result = runPR(lists, 1, 0, "DHONDT", false, ballots);

    expect(result.tieBreaks).toHaveLength(1);
    expect(result.tieBreaks[0].method).toBe("random");
    expect(["A", "B"]).toContain(result.tieBreaks[0].winnerId);
    const totalSeats = result.lists.reduce((sum, l) => sum + l.seatsWon, 0);
    expect(totalSeats).toBe(1);
  });

  it("rejects fewer than 2 lists", () => {
    const lists: PrListInput[] = [{ id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) }];
    expect(() => runPR(lists, 1, 0, "DHONDT", false, ballotsFor("A", 5))).toThrow(PrValidationError);
  });

  it("rejects a non-positive-integer seat count", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 2) },
    ];
    expect(() => runPR(lists, 0, 0, "DHONDT", false, ballotsFor("A", 5))).toThrow(PrValidationError);
  });

  it("rejects a threshold outside 0-100", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 2) },
    ];
    expect(() => runPR(lists, 1, 150, "DHONDT", false, ballotsFor("A", 5))).toThrow(PrValidationError);
  });

  it("rejects a list with fewer candidates than the number of seats", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 1) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 3) },
    ];
    expect(() => runPR(lists, 3, 0, "DHONDT", false, ballotsFor("A", 5))).toThrow(PrValidationError);
  });

  it("rejects zero ballots", () => {
    const lists: PrListInput[] = [
      { id: "A", name: "Alpha", abbreviation: "A", candidates: candidates("A", 2) },
      { id: "B", name: "Beta", abbreviation: "B", candidates: candidates("B", 2) },
    ];
    expect(() => runPR(lists, 1, 0, "DHONDT", false, [])).toThrow(PrValidationError);
  });
});
