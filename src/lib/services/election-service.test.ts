import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { deleteElections, updateVotingSystem, updatePrSettings, checkPrReadyToOpen } = await import("./election-service");

describe("deleteElections", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.candidates.length = 0;
    fakePrisma._data.accessCodes.length = 0;
    fakePrisma._data.voterSessions.length = 0;
    fakePrisma._data.ballots.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("deletes a DRAFT election and its dependent rows", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Draft Election", status: "DRAFT" });
    fakePrisma._data.candidates.push({ id: "c1", electionId: "e1" });

    const result = await deleteElections(["e1"], "admin1");

    expect(result.deletedIds).toEqual(["e1"]);
    expect(result.blocked).toEqual([]);
    expect(fakePrisma._data.elections).toHaveLength(0);
    expect(fakePrisma._data.candidates).toHaveLength(0);
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("deletes a CLOSED election along with its ballots and access codes", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Closed Election", status: "CLOSED" });
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: "h1",
      maxUses: null,
      useCount: 1,
      active: true,
      expiresAt: null,
    });
    fakePrisma._data.voterSessions.push({
      id: "vs1",
      electionId: "e1",
      accessCodeId: "ac1",
      ballotSubmitted: true,
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    fakePrisma._data.ballots.push({
      id: "b1",
      electionId: "e1",
      voterSessionId: "vs1",
      ranking: "[]",
      submittedAt: new Date(),
    });

    const result = await deleteElections(["e1"], "admin1");

    expect(result.deletedIds).toEqual(["e1"]);
    expect(fakePrisma._data.ballots).toHaveLength(0);
    expect(fakePrisma._data.voterSessions).toHaveLength(0);
    expect(fakePrisma._data.accessCodes).toHaveLength(0);
  });

  it("refuses to delete an OPEN (still running) election and reports it as blocked", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Live Election", status: "OPEN" });

    const result = await deleteElections(["e1"], "admin1");

    expect(result.deletedIds).toEqual([]);
    expect(result.blocked).toEqual([{ id: "e1", title: "Live Election" }]);
    expect(fakePrisma._data.elections).toHaveLength(1);
    expect(fakePrisma._data.auditLogs).toHaveLength(0);
  });

  it("deletes the deletable elections in a batch while blocking the running one", async () => {
    fakePrisma._data.elections.push(
      { id: "e1", title: "Draft", status: "DRAFT" },
      { id: "e2", title: "Live", status: "OPEN" },
      { id: "e3", title: "Closed", status: "CLOSED" }
    );

    const result = await deleteElections(["e1", "e2", "e3"], "admin1");

    expect(result.deletedIds.sort()).toEqual(["e1", "e3"]);
    expect(result.blocked).toEqual([{ id: "e2", title: "Live" }]);
    expect(fakePrisma._data.elections.map((e) => e.id)).toEqual(["e2"]);
  });

  it("ignores ids that don't match any election", async () => {
    const result = await deleteElections(["does-not-exist"], "admin1");
    expect(result.deletedIds).toEqual([]);
    expect(result.blocked).toEqual([]);
  });
});

describe("updateVotingSystem", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.ballots.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("changes the voting system while the election is still DRAFT with no ballots", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Draft", status: "DRAFT", votingSystem: "STV" });

    const result = await updateVotingSystem("e1", "FPTP", "admin1");

    expect(result.ok).toBe(true);
    expect(fakePrisma._data.elections[0].votingSystem).toBe("FPTP");
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("refuses to change it once the election is OPEN", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Live", status: "OPEN", votingSystem: "STV" });

    const result = await updateVotingSystem("e1", "FPTP", "admin1");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("NOT_DRAFT");
    expect(fakePrisma._data.elections[0].votingSystem).toBe("STV");
  });

  it("refuses to change it once the election is CLOSED", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Done", status: "CLOSED", votingSystem: "STV" });

    const result = await updateVotingSystem("e1", "FPTP", "admin1");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("NOT_DRAFT");
  });

  it("refuses to change it if ballots already exist, even if somehow back in DRAFT", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Weird state", status: "DRAFT", votingSystem: "STV" });
    fakePrisma._data.ballots.push({
      id: "b1",
      electionId: "e1",
      voterSessionId: "vs1",
      ranking: "[]",
      submittedAt: new Date(),
    });

    const result = await updateVotingSystem("e1", "FPTP", "admin1");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("HAS_BALLOTS");
    expect(fakePrisma._data.elections[0].votingSystem).toBe("STV");
  });

  it("reports NOT_FOUND for an election that doesn't exist", async () => {
    const result = await updateVotingSystem("does-not-exist", "FPTP", "admin1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("NOT_FOUND");
  });
});

describe("updatePrSettings", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("updates threshold, method, and blank-vote setting while DRAFT", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", votingSystem: "PR" });

    const result = await updatePrSettings("e1", { prThreshold: 5, prCalculationMethod: "SAINTE_LAGUE", prAllowBlankVote: true }, "admin1");

    expect(result.ok).toBe(true);
    expect(fakePrisma._data.elections[0]).toMatchObject({
      prThreshold: 5,
      prCalculationMethod: "SAINTE_LAGUE",
      prAllowBlankVote: true,
    });
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("refuses to change settings once the election is OPEN", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "OPEN", votingSystem: "PR", prThreshold: 0 });
    const result = await updatePrSettings("e1", { prThreshold: 5, prCalculationMethod: "DHONDT", prAllowBlankVote: false }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_DRAFT");
    expect(fakePrisma._data.elections[0].prThreshold).toBe(0);
  });

  it("rejects a threshold outside 0-100", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", votingSystem: "PR" });
    const result = await updatePrSettings("e1", { prThreshold: 150, prCalculationMethod: "DHONDT", prAllowBlankVote: false }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_THRESHOLD");
  });

  it("reports NOT_FOUND for an unknown election", async () => {
    const result = await updatePrSettings("does-not-exist", { prThreshold: 0, prCalculationMethod: "DHONDT", prAllowBlankVote: false }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_FOUND");
  });
});

describe("checkPrReadyToOpen", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.partyLists.length = 0;
    fakePrisma._data.partyListCandidates.length = 0;
  });

  it("is a no-op (always ok) for a non-PR election", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", votingSystem: "STV" });
    const result = await checkPrReadyToOpen("e1");
    expect(result.ok).toBe(true);
  });

  it("blocks opening with fewer than 2 lists", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", votingSystem: "PR", seats: 2 });
    fakePrisma._data.partyLists.push({ id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A" });
    const result = await checkPrReadyToOpen("e1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 2 lists/i);
  });

  it("blocks opening when a list has fewer candidates than total seats", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", votingSystem: "PR", seats: 2 });
    fakePrisma._data.partyLists.push(
      { id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A" },
      { id: "l2", electionId: "e1", name: "Beta", abbreviation: "B" }
    );
    fakePrisma._data.partyListCandidates.push(
      { id: "c1", listId: "l1", firstName: "A", lastName: "One", rank: 1 },
      { id: "c2", listId: "l1", firstName: "A", lastName: "Two", rank: 2 },
      { id: "c3", listId: "l2", firstName: "B", lastName: "One", rank: 1 }
    );
    const result = await checkPrReadyToOpen("e1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/"Beta"/);
  });

  it("allows opening when every list meets the seat minimum", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", votingSystem: "PR", seats: 2 });
    fakePrisma._data.partyLists.push(
      { id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A" },
      { id: "l2", electionId: "e1", name: "Beta", abbreviation: "B" }
    );
    fakePrisma._data.partyListCandidates.push(
      { id: "c1", listId: "l1", firstName: "A", lastName: "One", rank: 1 },
      { id: "c2", listId: "l1", firstName: "A", lastName: "Two", rank: 2 },
      { id: "c3", listId: "l2", firstName: "B", lastName: "One", rank: 1 },
      { id: "c4", listId: "l2", firstName: "B", lastName: "Two", rank: 2 }
    );
    const result = await checkPrReadyToOpen("e1");
    expect(result.ok).toBe(true);
  });
});
