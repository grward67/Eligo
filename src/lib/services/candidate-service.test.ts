import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { addCandidate } = await import("./candidate-service");

describe("addCandidate", () => {
  beforeEach(() => {
    fakePrisma._data.elections.length = 0;
    fakePrisma._data.candidates.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("adds a candidate while the election is DRAFT", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    const result = await addCandidate("e1", "Alice", "Independent", "admin1");
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.candidates).toHaveLength(1);
    expect(fakePrisma._data.candidates[0]).toMatchObject({ name: "Alice", party: "Independent", sortOrder: 0 });
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("assigns increasing sortOrder to successive candidates", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    await addCandidate("e1", "Alice", null, "admin1");
    await addCandidate("e1", "Bob", null, "admin1");
    expect(fakePrisma._data.candidates.map((c) => c.sortOrder)).toEqual([0, 1]);
  });

  it("refuses to add a candidate once the election is OPEN", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "OPEN" });
    const result = await addCandidate("e1", "Alice", null, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_DRAFT");
    expect(fakePrisma._data.candidates).toHaveLength(0);
  });

  it("refuses to add a candidate once the election is CLOSED", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "CLOSED" });
    const result = await addCandidate("e1", "Alice", null, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_DRAFT");
  });

  it("reports NOT_FOUND for an unknown election", async () => {
    const result = await addCandidate("does-not-exist", "Alice", null, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_FOUND");
  });
});
