import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { buildElectionCountLog } = await import("./election-count-log-service");

describe("buildElectionCountLog", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.candidates.length = 0;
    fakePrisma._data.partyLists.length = 0;
    fakePrisma._data.partyListCandidates.length = 0;
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
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "CLOSED", seats: 2 });
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
    const rounds = result.log.rounds;
    if (!rounds) throw new Error("expected STV log to include rounds");
    expect(rounds).toHaveLength(4);

    // Round 1: Alice elected, surplus transfers to Bob/Carol/Dave by name.
    expect(rounds[0].action).toBe("elect");
    const round1Transfers = Object.fromEntries(rounds[0].transfersIn.map((t) => [t.name, t.amount]));
    expect(round1Transfers).toEqual({ Bob: 0.4, Carol: 0.4, Dave: 0.2 });

    // Round 2: Carol eliminated, transfers to Dave, some exhausts.
    expect(rounds[1].action).toBe("eliminate");
    const round2Transfers = Object.fromEntries(rounds[1].transfersIn.map((t) => [t.name, t.amount]));
    expect(round2Transfers).toEqual({ Dave: 1 });
    expect(rounds[1].transferExhausted).toBeCloseTo(0.4);

    // Final round ends the count -- no further transfer to observe.
    expect(rounds[3].action).toBe("elect-remaining");
    expect(rounds[3].transfersIn).toEqual([]);
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

  it("builds a simple candidate/vote-count log for FPTP elections, with no rounds or quota", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "FPTP Election", status: "CLOSED", votingSystem: "FPTP", seats: 1 });
    fakePrisma._data.candidates.push(
      { id: "A", electionId: "e1", name: "Alice", party: null, sortOrder: 0 },
      { id: "B", electionId: "e1", name: "Bob", party: null, sortOrder: 1 }
    );
    const rankings = [["A"], ["A"], ["B"]];
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

    expect(result.log.votingSystem).toBe("FPTP");
    expect(result.log.quota).toBeUndefined();
    expect(result.log.rounds).toBeUndefined();
    expect(result.log.winners.map((w) => w.name)).toEqual(["Alice"]);
    expect(result.log.tallies).toEqual([
      { name: "Alice", party: null, votes: 2, status: "elected" },
      { name: "Bob", party: null, votes: 1, status: "not-elected" },
    ]);
  });

  it("propagates an FPTP validation error as INVALID rather than throwing", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Broken FPTP Election", status: "OPEN", votingSystem: "FPTP" });
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

  it("builds a per-list vote/seat breakdown plus per-list elected candidates for PR elections", async () => {
    fakePrisma._data.elections.push({
      id: "e1",
      title: "PR Election",
      status: "CLOSED",
      votingSystem: "PR",
      seats: 3,
      prThreshold: 0,
      prCalculationMethod: "DHONDT",
      prAllowBlankVote: true,
    });
    fakePrisma._data.partyLists.push(
      { id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A", sortOrder: 0 },
      { id: "l2", electionId: "e1", name: "Beta", abbreviation: "B", sortOrder: 1 }
    );
    fakePrisma._data.partyListCandidates.push(
      { id: "c1", listId: "l1", firstName: "Ann", lastName: "One", rank: 1 },
      { id: "c2", listId: "l1", firstName: "Ann", lastName: "Two", rank: 2 },
      { id: "c3", listId: "l1", firstName: "Ann", lastName: "Three", rank: 3 },
      { id: "c4", listId: "l2", firstName: "Bea", lastName: "One", rank: 1 },
      { id: "c5", listId: "l2", firstName: "Bea", lastName: "Two", rank: 2 },
      { id: "c6", listId: "l2", firstName: "Bea", lastName: "Three", rank: 3 }
    );
    const rankings = [["l1"], ["l1"], ["l1"], ["l1"], ["l1"], ["l1"], ["l1"], ["l1"], ["l1"], ["l1"], ["l2"], ["l2"], ["l2"], ["l2"], ["l2"], ["l2"], ["BLANK"]];
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

    expect(result.log.votingSystem).toBe("PR");
    expect(result.log.totalValidVotes).toBe(16);
    expect(result.log.blankVotes).toBe(1);
    expect(result.log.quota).toBeUndefined();
    expect(result.log.rounds).toBeUndefined();
    expect(result.log.tallies).toBeUndefined();

    const lists = result.log.lists;
    if (!lists) throw new Error("expected PR log to include lists");
    const alpha = lists.find((l) => l.abbreviation === "A")!;
    expect(alpha.votes).toBe(10);
    expect(alpha.seatsWon).toBe(2);
    expect(alpha.candidates.map((c) => c.status)).toEqual(["elected", "elected", "not-elected"]);

    const beta = lists.find((l) => l.abbreviation === "B")!;
    expect(beta.votes).toBe(6);
    expect(beta.seatsWon).toBe(1);

    expect(result.log.winners.map((w) => w.name)).toEqual(["Ann One", "Ann Two", "Bea One"]);
  });

  it("propagates a PR validation error as INVALID rather than throwing", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Broken PR Election", status: "OPEN", votingSystem: "PR", seats: 1 });
    fakePrisma._data.partyLists.push({ id: "l1", electionId: "e1", name: "Only List", abbreviation: "O", sortOrder: 0 });
    fakePrisma._data.partyListCandidates.push({ id: "c1", listId: "l1", firstName: "Ann", lastName: "One", rank: 1 });
    fakePrisma._data.ballots.push({
      id: "b1",
      electionId: "e1",
      voterSessionId: "vs1",
      ranking: JSON.stringify(["l1"]),
      submittedAt: new Date(),
    });

    const result = await buildElectionCountLog("e1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("INVALID");
      expect(result.message).toMatch(/at least 2 lists/i);
    }
  });
});
