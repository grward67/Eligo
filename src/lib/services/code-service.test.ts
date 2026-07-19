import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { generateCodes, revokeCode, MAX_GENERATE_COUNT } = await import("./code-service");

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
