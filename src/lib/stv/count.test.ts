import { describe, it, expect } from "vitest";
import { runSTV, StvValidationError } from "./count";

describe("runSTV", () => {
  it("elects by quota with surplus transfer, then eliminates down to the remaining seat", () => {
    // Same 4-candidate / 2-seat / 10-ballot scenario verified by hand and
    // against the original vanilla-JS implementation:
    // quota = floor(10/3)+1 = 4; Alice elected round 1 with surplus 1
    // (transfer value 0.2); Carol then Bob eliminated; Dave takes the
    // final seat by the "remaining seats == remaining hopefuls" shortcut.
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
      { id: "D", name: "Dave" },
    ];
    const rankings = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["A", "B"],
      ["A", "C"],
      ["B", "C"],
      ["B", "D"],
      ["C", "D"],
      ["D", "A"],
      ["D", "B"],
    ];

    const result = runSTV(
      candidates,
      2,
      rankings.map((ranking) => ({ ranking }))
    );

    expect(result.quota).toBe(4);
    expect(result.totalValidVotes).toBe(10);
    expect(result.winners.map((w) => w.id)).toEqual(["A", "D"]);

    expect(result.rounds[0].action).toBe("elect");
    expect(result.rounds[0].electedId).toBe("A");
    expect(result.rounds[0].surplus).toBeCloseTo(1);
    expect(result.rounds[0].transferValue).toBeCloseTo(0.2);

    const eliminated = result.rounds.filter((r) => r.action === "eliminate").map((r) => r.eliminatedId);
    expect(eliminated).toEqual(["C", "B"]);

    expect(result.rounds.at(-1)?.action).toBe("elect-remaining");
    expect(result.rounds.at(-1)?.electedIds).toEqual(["D"]);
  });

  it("ignores ballots with an empty ranking when computing the quota", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
    ];
    const result = runSTV(candidates, 1, [
      { ranking: ["A"] },
      { ranking: ["A"] },
      { ranking: [] },
    ]);
    expect(result.totalValidVotes).toBe(2);
  });

  it("throws when fewer than 2 candidates are supplied", () => {
    expect(() => runSTV([{ id: "A", name: "Alice" }], 1, [{ ranking: ["A"] }])).toThrow(StvValidationError);
  });

  it("throws when seats is not fewer than the candidate count", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
    ];
    expect(() => runSTV(candidates, 2, [{ ranking: ["A"] }])).toThrow(StvValidationError);
  });

  it("throws when there are no valid ballots", () => {
    const candidates = [
      { id: "A", name: "Alice" },
      { id: "B", name: "Bob" },
      { id: "C", name: "Carol" },
    ];
    expect(() => runSTV(candidates, 1, [])).toThrow(StvValidationError);
  });
});
