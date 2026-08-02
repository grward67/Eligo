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

    // exhausted: newly-exhausted-this-round; cumulativeExhausted: running
    // total. Nothing exhausts until Carol's eliminated ballots (b2, b5:
    // [A,C], value 0.2 each after A's surplus transfer) run out of
    // preferences in round 3 (0.2+0.2=0.4). Round 4 adds Bob's eliminated
    // ballots that also have nowhere left to go: b6 [B,C] (both eliminated,
    // value 1) plus b1/b4 [A,B] (value 0.2 each after transfer) = 1.4.
    expect(result.rounds.map((r) => r.exhausted)).toEqual([0, 0, 0.4, 1.4]);
    expect(result.rounds.map((r) => r.cumulativeExhausted)).toEqual([0, 0, 0.4, 1.8]);

    // Conservation check: every one of the 10 ballots is accounted for by
    // either a winner's final tally or exhaustion. Alice's tally freezes at
    // the moment she's elected (her surplus already transferred out by
    // then), so use the surplus-round tally rather than the final round's
    // (where she shows 0, as elected candidates always do afterward).
    const aliceTally = result.rounds[0].tallies.find((t) => t.id === "A")!.votes;
    const daveTally = result.rounds.at(-1)!.tallies.find((t) => t.id === "D")!.votes;
    const finalExhausted = result.rounds.at(-1)!.cumulativeExhausted;
    expect(aliceTally + daveTally + finalExhausted).toBeCloseTo(10);

    // Per-round transfer breakdown, hand-traced ballot by ballot:
    // Round 1 (elect Alice, surplus 1): her 5 ballots (each now worth 0.2)
    // land on b1->B, b2->C, b3->D, b4->B, b5->C -> B and C each get two
    // (0.4), D gets one (0.2). Total transferred = 1.0 = the surplus.
    expect(result.rounds[0].transfersIn).toEqual({ B: 0.4, C: 0.4, D: 0.2 });
    expect(result.rounds[0].transferExhausted).toBeCloseTo(0);

    // Round 2 (eliminate Carol, 1.4): b8 [C,D] transfers its full value (1)
    // to D; b2/b5 [A,C] have no further preference and exhaust (0.2 each).
    // 1 + 0.4 = 1.4, matching Carol's round-2 total exactly.
    expect(result.rounds[1].transfersIn).toEqual({ D: 1 });
    expect(result.rounds[1].transferExhausted).toBeCloseTo(0.4);

    // Round 3 (eliminate Bob, 2.4): b7 [B,D] transfers its value (1) to D;
    // b1/b4 [A,B] (0.2 each) and b6 [B,C] (1, since C is also already
    // eliminated) all have nowhere left to go and exhaust. 1 + 1.4 = 2.4,
    // matching Bob's round-3 total exactly.
    expect(result.rounds[2].transfersIn).toEqual({ D: 1 });
    expect(result.rounds[2].transferExhausted).toBeCloseTo(1.4);

    // Round 4 ends the count -- nothing follows it to observe a transfer in.
    expect(result.rounds[3].transfersIn).toEqual({});
    expect(result.rounds[3].transferExhausted).toBe(0);

    // Each round's transferExhausted must equal the next round's exhausted.
    for (let i = 0; i < result.rounds.length - 1; i++) {
      expect(result.rounds[i].transferExhausted).toBeCloseTo(result.rounds[i + 1].exhausted);
    }
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
