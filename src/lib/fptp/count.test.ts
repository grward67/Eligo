import { describe, it, expect } from "vitest";
import { runFPTP, FptpValidationError } from "./count";

describe("runFPTP", () => {
  it("elects the single candidate with the most votes", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
    ];
    const ballots = [
      { ranking: ["A"] },
      { ranking: ["A"] },
      { ranking: ["A"] },
      { ranking: ["B"] },
      { ranking: ["B"] },
      { ranking: ["C"] },
    ];

    const result = runFPTP(candidates, 1, ballots);

    expect(result.totalValidVotes).toBe(6);
    expect(result.winners.map((w) => w.id)).toEqual(["A"]);
    expect(result.tallies.map((t) => [t.id, t.votes, t.status])).toEqual([
      ["A", 3, "elected"],
      ["B", 2, "not-elected"],
      ["C", 1, "not-elected"],
    ]);
  });

  it("elects the top N candidates for a multi-seat plurality count", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
      { id: "D", name: "Dave" },
    ];
    const ballots = [
      { ranking: ["A"] },
      { ranking: ["A"] },
      { ranking: ["B"] },
      { ranking: ["B"] },
      { ranking: ["C"] },
      { ranking: ["D"] },
    ];

    const result = runFPTP(candidates, 2, ballots);

    expect(result.winners.map((w) => w.id).sort()).toEqual(["A", "B"]);
  });

  it("only reads the first entry of each ballot's ranking", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
    ];
    // A submitBallot() bug or legacy data could in theory store more than
    // one entry; runFPTP should not choke on it, just ignore the extras.
    const result = runFPTP(candidates, 1, [{ ranking: ["A", "B"] }, { ranking: ["B"] }]);
    expect(result.tallies.find((t) => t.id === "A")!.votes).toBe(1);
    expect(result.tallies.find((t) => t.id === "B")!.votes).toBe(1);
  });

  it("ignores ballots with an empty ranking", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
    ];
    const result = runFPTP(candidates, 1, [{ ranking: ["A"] }, { ranking: [] }]);
    expect(result.totalValidVotes).toBe(1);
  });

  it("breaks a tie for the last seat by candidate list order", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
    ];
    const ballots = [{ ranking: ["A"] }, { ranking: ["B"] }];
    const result = runFPTP(candidates, 1, ballots);
    // A and B are tied 1-1; A is listed first, so A wins deterministically.
    expect(result.winners.map((w) => w.id)).toEqual(["A"]);
  });

  it("throws when fewer than 2 candidates are supplied", () => {
    expect(() => runFPTP([{ id: "A", name: "Alice" }], 1, [{ ranking: ["A"] }])).toThrow(FptpValidationError);
  });

  it("throws when seats is not fewer than the candidate count", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
    ];
    expect(() => runFPTP(candidates, 2, [{ ranking: ["A"] }])).toThrow(FptpValidationError);
  });

  it("throws when there are no valid ballots", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
    ];
    expect(() => runFPTP(candidates, 1, [])).toThrow(FptpValidationError);
  });
});
