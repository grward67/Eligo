import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { buildVotingLog } = await import("./voting-log-service");

describe("buildVotingLog", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.candidates.length = 0;
    fakePrisma._data.partyLists.length = 0;
    fakePrisma._data.ballots.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("returns null for an election that doesn't exist", async () => {
    const log = await buildVotingLog("does-not-exist");
    expect(log).toBeNull();
  });

  it("derives the first OPEN and most recent CLOSED timestamps from the audit trail", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "CLOSED" });

    const openedFirst = new Date("2026-01-01T10:00:00Z");
    const closedThenReopened = new Date("2026-01-01T11:00:00Z");
    const reopened = new Date("2026-01-01T12:00:00Z");
    const closedFinal = new Date("2026-01-01T13:00:00Z");

    fakePrisma._data.auditLogs.push(
      {
        id: "a1",
        actorType: "admin",
        actorId: "admin1",
        action: "election.status_change",
        targetType: "Election",
        targetId: "e1",
        metadata: JSON.stringify({ status: "OPEN" }),
        createdAt: openedFirst,
      },
      {
        id: "a2",
        actorType: "admin",
        actorId: "admin1",
        action: "election.status_change",
        targetType: "Election",
        targetId: "e1",
        metadata: JSON.stringify({ status: "CLOSED" }),
        createdAt: closedThenReopened,
      },
      {
        id: "a3",
        actorType: "admin",
        actorId: "admin1",
        action: "election.status_change",
        targetType: "Election",
        targetId: "e1",
        metadata: JSON.stringify({ status: "OPEN" }),
        createdAt: reopened,
      },
      {
        id: "a4",
        actorType: "admin",
        actorId: "admin1",
        action: "election.status_change",
        targetType: "Election",
        targetId: "e1",
        metadata: JSON.stringify({ status: "CLOSED" }),
        createdAt: closedFinal,
      }
    );

    const log = await buildVotingLog("e1");

    expect(log).not.toBeNull();
    // First OPEN wins for the start date, even though it was reopened later.
    expect(log!.startedAt).toBe(openedFirst.toISOString());
    // Most recent CLOSED wins for the end date.
    expect(log!.endedAt).toBe(closedFinal.toISOString());
  });

  it("reports null dates when the election was never opened or closed", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Draft Election", status: "DRAFT" });
    const log = await buildVotingLog("e1");
    expect(log!.startedAt).toBeNull();
    expect(log!.endedAt).toBeNull();
  });

  it("numbers ballots sequentially by submission order, not database order", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "CLOSED" });
    fakePrisma._data.candidates.push(
      { id: "c1", electionId: "e1", name: "Alice", party: null, sortOrder: 0 },
      { id: "c2", electionId: "e1", name: "Bob", party: null, sortOrder: 1 }
    );
    // Pushed out of chronological order on purpose.
    fakePrisma._data.ballots.push(
      { id: "b2", electionId: "e1", voterSessionId: "vs2", ranking: '["c2"]', submittedAt: new Date("2026-01-01T10:05:00Z") },
      { id: "b1", electionId: "e1", voterSessionId: "vs1", ranking: '["c1","c2"]', submittedAt: new Date("2026-01-01T10:00:00Z") }
    );

    const log = await buildVotingLog("e1");

    expect(log!.candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(log!.ballots).toEqual([
      { ballotNumber: 1, ranking: ["c1", "c2"] },
      { ballotNumber: 2, ranking: ["c2"] },
    ]);
  });

  it("uses party lists (plus a Blank vote column when allowed) as the columns for a PR election", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "PR Election", status: "CLOSED", votingSystem: "PR", prAllowBlankVote: true });
    fakePrisma._data.partyLists.push(
      { id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A", sortOrder: 0 },
      { id: "l2", electionId: "e1", name: "Beta", abbreviation: "B", sortOrder: 1 }
    );
    fakePrisma._data.ballots.push(
      { id: "b1", electionId: "e1", voterSessionId: "vs1", ranking: '["l1"]', submittedAt: new Date("2026-01-01T10:00:00Z") },
      { id: "b2", electionId: "e1", voterSessionId: "vs2", ranking: '["BLANK"]', submittedAt: new Date("2026-01-01T10:05:00Z") }
    );

    const log = await buildVotingLog("e1");

    expect(log!.candidates).toEqual([
      { id: "l1", name: "Alpha", party: "A" },
      { id: "l2", name: "Beta", party: "B" },
      { id: "BLANK", name: "Blank vote", party: null },
    ]);
    expect(log!.ballots).toEqual([
      { ballotNumber: 1, ranking: ["l1"] },
      { ballotNumber: 2, ranking: ["BLANK"] },
    ]);
  });

  it("omits the Blank vote column when the PR election doesn't allow blank votes", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "PR Election", status: "CLOSED", votingSystem: "PR", prAllowBlankVote: false });
    fakePrisma._data.partyLists.push({ id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A", sortOrder: 0 });
    fakePrisma._data.ballots.push({ id: "b1", electionId: "e1", voterSessionId: "vs1", ranking: '["l1"]', submittedAt: new Date() });

    const log = await buildVotingLog("e1");

    expect(log!.candidates).toEqual([{ id: "l1", name: "Alpha", party: "A" }]);
  });
});
