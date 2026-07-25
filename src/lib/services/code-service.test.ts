import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";
import { hashAccessCode } from "@/lib/auth/access-code";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { generateCodes, revokeCode, lookupCode, MAX_GENERATE_COUNT } = await import("./code-service");

describe("generateCodes", () => {
  beforeEach(() => {
    fakePrisma._data.accessCodes.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("generates the requested number of codes with unique plaintext values", async () => {
    const codes = await generateCodes({
      electionId: "e1",
      count: 50,
      maxUses: 1,
      createdById: "admin1",
    });

    expect(codes).toHaveLength(50);
    expect(new Set(codes.map((c) => c.plaintextCode)).size).toBe(50);
    expect(fakePrisma._data.accessCodes).toHaveLength(50);
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("handles a large batch (the scenario that used to silently fail at 1280)", async () => {
    const codes = await generateCodes({
      electionId: "e1",
      count: 1280,
      maxUses: null,
      createdById: "admin1",
    });

    expect(codes).toHaveLength(1280);
    expect(fakePrisma._data.accessCodes).toHaveLength(1280);
    expect(new Set(codes.map((c) => c.plaintextCode)).size).toBe(1280);
  });

  it("rejects a count above the maximum", async () => {
    await expect(
      generateCodes({ electionId: "e1", count: MAX_GENERATE_COUNT + 1, maxUses: 1, createdById: "admin1" })
    ).rejects.toThrow();
    expect(fakePrisma._data.accessCodes).toHaveLength(0);
  });

  it("rejects a count below 1", async () => {
    await expect(
      generateCodes({ electionId: "e1", count: 0, maxUses: 1, createdById: "admin1" })
    ).rejects.toThrow();
  });

  it("stores every generated code as active with the requested maxUses", async () => {
    await generateCodes({ electionId: "e1", count: 3, maxUses: 5, createdById: "admin1" });
    for (const c of fakePrisma._data.accessCodes) {
      expect(c.active).toBe(true);
      expect(c.maxUses).toBe(5);
      expect(c.useCount).toBe(0);
    }
  });
});

describe("revokeCode", () => {
  beforeEach(() => {
    fakePrisma._data.accessCodes.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("marks the code inactive and writes an audit log entry", async () => {
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: "h1",
      maxUses: 1,
      useCount: 0,
      active: true,
      expiresAt: null,
    });

    await revokeCode("ac1", "admin1");

    expect(fakePrisma._data.accessCodes[0].active).toBe(false);
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });
});

describe("lookupCode", () => {
  const CODE = "5UR87-5C8S2";
  const CODE_HASH = hashAccessCode(CODE);

  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.accessCodes.length = 0;
    fakePrisma._data.voterSessions.length = 0;
    fakePrisma._data.ballots.length = 0;
  });

  it("reports not found for a code that doesn't exist", async () => {
    const result = await lookupCode("NOPE0-00000");
    expect(result.found).toBe(false);
  });

  it("reports an active, not-yet-voted code correctly", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "OPEN" });
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      label: "Batch 1",
      maxUses: 1,
      useCount: 2,
      active: true,
      expiresAt: null,
    });

    const result = await lookupCode(CODE);

    expect(result.found).toBe(true);
    expect(result.electionTitle).toBe("Test Election");
    expect(result.label).toBe("Batch 1");
    expect(result.active).toBe(true);
    expect(result.hasVoted).toBe(false);
    expect(result.votedAt).toBeNull();
  });

  it("reports a voted code along with when the vote was cast", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "OPEN" });
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: 1,
      useCount: 3,
      active: false,
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
    const votedAt = new Date("2026-01-01T12:00:00Z");
    fakePrisma._data.ballots.push({
      id: "b1",
      electionId: "e1",
      voterSessionId: "vs1",
      ranking: "[]",
      submittedAt: votedAt,
    });

    const result = await lookupCode(CODE);

    expect(result.found).toBe(true);
    expect(result.active).toBe(false);
    expect(result.hasVoted).toBe(true);
    expect(result.votedAt).toEqual(votedAt);
  });

  it("is insensitive to case, spacing, and dashes, matching how voters type it", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Test Election", status: "OPEN" });
    fakePrisma._data.accessCodes.push({
      id: "ac1",
      electionId: "e1",
      codeHash: CODE_HASH,
      maxUses: 1,
      useCount: 0,
      active: true,
      expiresAt: null,
    });

    const result = await lookupCode(" 5ur875c8s2 ");
    expect(result.found).toBe(true);
  });
});
