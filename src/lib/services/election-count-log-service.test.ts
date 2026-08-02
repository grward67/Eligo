import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { buildElectionCountLog } = await import("./election-count-log-service");

describe("buildElectionCountLog", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.candidates.length = 0;
    fakePrisma._data.ballots.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("reports NOT_FOUND for an election that doesn't exist", async () => {
    const result = await buildElectionCountLog("does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_FOUND");
  });

  it("reports NO_BALLOTS when nobody has voted yet", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "OPEN" });
    const result = await buildElectionCountLog("e1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NO_BALLOTS");
  });

  it("builds the full round-by-round log with named transfer breakdowns", async () => {
    // Same 4-candidate / 2-seat / 10-ballot scenario verified in count.test.ts.
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "CLOSED" });
    fakePrisma._data.candidates.push(
      { id: "A", electionId: "e1", name: "Alice", party: null, sortOrder: 0 },
      { id: "B", electionId: "e1", name: "Bob", party: null, sortOrder: 1 },
      { id: "C", electionId: "e1", name: "Carol", party: null, sortOrder: 2 },
      { id: "D", electionId: "e1", name: "Dave", party: null, sortOrder: 3 }
    );

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
    rankings.forEach((ranking, i) => {
      fakePrisma._data.ballots.push({
        id: `b${i}`,
        electionId: "e1",
        voterSessionId: `vs${i}`,
        ranking: JSON.stringify(ranking),
        submittedAt: new Date(),
      });
    });

    const result = await buildElectionCountLog("e1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.log.electionTitle).toBe("Test Election");
    expect(result.log.quota).toBe(4);
    expect(result.log.winners.map((w) => w.name)).toEqual(["Alice", "Dave"]);
    expect(result.log.rounds).toHaveLength(4);

    // Round 1: Alice elected, surplus transfers to Bob/Carol/Dave by name.
    expect(result.log.rounds[0].action).toBe("elect");
    const round1Transfers = Object.fromEntries(result.log.rounds[0].transfersIn.map((t) => [t.name, t.amount]));
    expect(round1Transfers).toEqual({ Bob: 0.4, Carol: 0.4, Dave: 0.2 });

    // Round 2: Carol eliminated, transfers to Dave, some exhausts.
    expect(result.log.rounds[1].action).toBe("eliminate");
    const round2Transfers = Object.fromEntries(result.log.rounds[1].transfersIn.map((t) => [t.name, t.amount]));
    expect(round2Transfers).toEqual({ Dave: 1 });
    expect(result.log.rounds[1].transferExhausted).toBeCloseTo(0.4);

    // Final round ends the count -- no further transfer to observe.
    expect(result.log.rounds[3].action).toBe("elect-remaining");
    expect(result.log.rounds[3].transfersIn).toEqual([]);
  });

  it("propagates an STV validation error as INVALID rather than throwing", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Broken Election", status: "OPEN" });
    fakePrisma._data.candidates.push({ id: "c1", electionId: "e1", name: "Only Candidate", party: null, sortOrder: 0 });
    fakePrisma._data.ballots.push({
      id: "b1",
      electionId: "e1",
      voterSessionId: "vs1",
      ranking: JSON.stringify(["c1"]),
      submittedAt: new Date(),
    });

    const result = await buildElectionCountLog("e1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("INVALID");
      expect(result.message).toMatch(/at least 2 candidates/i);
    }
  });
});
