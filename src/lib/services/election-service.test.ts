import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { deleteElections } = await import("./election-service");

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
