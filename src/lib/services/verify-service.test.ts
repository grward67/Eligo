import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";
import { hashAccessCode } from "@/lib/auth/access-code";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { verifyAccessCode } = await import("./verify-service");

const CODE = "ABCDE-FGHJK";
const CODE_HASH = hashAccessCode(CODE);

function seedElection(status = "OPEN") {
  fakePrisma._data.elections.push({ id: "e1", status });
}

describe("verifyAccessCode", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.accessCodes.length = 0;
    fakePrisma._data.voterSessions.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("rejects when the election is not open", async () => {
    seedElection("DRAFT");
    const result = await verifyAccessCode("e1", CODE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ELECTION_NOT_OPEN");
  });

  it("rejects a code that doesn't match any stored hash", async () => {
    seedElection();
    const result = await verifyAccessCode("e1", "WRONG-CODE1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_CODE");
  });

  it("rejects an expired code", async () => {
    seedElection();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: null,
      useCount: 0,
      active: true,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await verifyAccessCode("e1", CODE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_CODE");
  });

  it("allows a one-time code to be verified more than once before any vote is cast", async () => {
    seedElection();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: 1,
      useCount: 0,
      active: true,
      expiresAt: null,
    });

    const first = await verifyAccessCode("e1", CODE);
    const second = await verifyAccessCode("e1", CODE);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fakePrisma._data.accessCodes[0].active).toBe(true);
    expect(fakePrisma._data.voterSessions).toHaveLength(2);
  });

  it("blocks a one-time code with a specific message once a vote has been cast through it", async () => {
    seedElection();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: 1,
      useCount: 2,
      active: false, // set by ballot-service.submitBallot when the vote was cast
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

    const result = await verifyAccessCode("e1", CODE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("ALREADY_VOTED");
  });

  it("treats a manually revoked one-time code (no vote cast) as a generic invalid code, not ALREADY_VOTED", async () => {
    seedElection();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: 1,
      useCount: 1,
      active: false, // revoked by an admin, not by voting
      expiresAt: null,
    });

    const result = await verifyAccessCode("e1", CODE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_CODE");
  });

  it("lets a reusable code be verified by multiple different sessions up to its cap", async () => {
    seedElection();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: 2,
      useCount: 0,
      active: true,
      expiresAt: null,
    });

    const first = await verifyAccessCode("e1", CODE);
    const second = await verifyAccessCode("e1", CODE);
    const third = await verifyAccessCode("e1", CODE);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error).toBe("INVALID_CODE");
    expect(fakePrisma._data.accessCodes[0].active).toBe(false);
  });

  it("lets an unlimited-use code be verified indefinitely", async () => {
    seedElection();
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: null,
      useCount: 0,
      active: true,
      expiresAt: null,
    });

    for (let i = 0; i < 5; i++) {
      const result = await verifyAccessCode("e1", CODE);
      expect(result.ok).toBe(true);
    }
    expect(fakePrisma._data.accessCodes[0].active).toBe(true);
    expect(fakePrisma._data.accessCodes[0].useCount).toBe(5);
  });
});
