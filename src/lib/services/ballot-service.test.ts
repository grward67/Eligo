import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { submitBallot } = await import("./ballot-service");

function seed() {
  fakePrisma._data.elections.push({ id: "e1", status: "OPEN" });
  fakePrisma._data.candidates.push({ id: "c1", electionId: "e1" }, { id: "c2", electionId: "e1" });
  fakePrisma._data.voterSessions.push({
    id: "vs1",
    electionId: "e1",
    accessCodeId: "ac1",
    ballotSubmitted: false,
    revoked: false,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
}

describe("submitBallot", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.candidates.length = 0;
    fakePrisma._data.accessCodes.length = 0;
    fakePrisma._data.voterSessions.length = 0;
    fakePrisma._data.ballots.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("accepts a valid ranking, records the ballot, and marks the session used", async () => {
    seed();
    const result = await submitBallot("vs1", "e1", ["c2", "c1"]);
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.ballots).toHaveLength(1);
    expect(JSON.parse(fakePrisma._data.ballots[0].ranking)).toEqual(["c2", "c1"]);
    expect(fakePrisma._data.voterSessions[0].ballotSubmitted).toBe(true);
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("rejects a ranking containing an unknown candidate id", async () => {
    seed();
    const result = await submitBallot("vs1", "e1", ["c1", "does-not-exist"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_RANKING");
    expect(fakePrisma._data.ballots).toHaveLength(0);
  });

  it("rejects a ranking with duplicate candidate ids", async () => {
    seed();
    const result = await submitBallot("vs1", "e1", ["c1", "c1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_RANKING");
  });

  it("rejects a second submission for the same session", async () => {
    seed();
    await submitBallot("vs1", "e1", ["c1"]);
    const second = await submitBallot("vs1", "e1", ["c2"]);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("ALREADY_SUBMITTED");
    expect(fakePrisma._data.ballots).toHaveLength(1);
  });

  it("rejects submission for a session id that does not exist", async () => {
    seed();
    const result = await submitBallot("does-not-exist", "e1", ["c1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("SESSION_NOT_FOUND");
  });

  it("rejects submission when the session's electionId does not match", async () => {
    seed();
    fakePrisma._data.elections.push({ id: "e2", status: "OPEN" });
    const result = await submitBallot("vs1", "e2", ["c1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("SESSION_NOT_FOUND");
  });

  it("rejects submission for an expired session", async () => {
    seed();
    fakePrisma._data.voterSessions[0].expiresAt = new Date(Date.now() - 1000);
    const result = await submitBallot("vs1", "e1", ["c1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("SESSION_EXPIRED");
  });

  it("rejects submission when the election is no longer open", async () => {
    seed();
    fakePrisma._data.elections[0].status = "CLOSED";
    const result = await submitBallot("vs1", "e1", ["c1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ELECTION_NOT_OPEN");
  });

  it("deactivates a one-time access code once its vote is cast", async () => {
    seed();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: "hash1",
      maxUses: 1,
      useCount: 1,
      active: true,
      expiresAt: null,
    });
    const result = await submitBallot("vs1", "e1", ["c1"]);
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.accessCodes[0].active).toBe(false);
  });

  it("leaves a reusable access code active after one of its votes is cast", async () => {
    seed();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: "hash1",
      maxUses: null,
      useCount: 1,
      active: true,
      expiresAt: null,
    });
    const result = await submitBallot("vs1", "e1", ["c1"]);
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.accessCodes[0].active).toBe(true);
  });
});
