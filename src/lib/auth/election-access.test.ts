import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { getOwnedElection, getOwnedPartyList, getOwnedAccessCode, getOwnedBallot } = await import("./election-access");

const owner = { sub: "admin1", email: "owner@example.com", role: "ACCOUNT_ADMIN" as const };
const otherAccountAdmin = { sub: "admin2", email: "other@example.com", role: "ACCOUNT_ADMIN" as const };
const productAdmin = { sub: "admin3", email: "product@example.com", role: "PRODUCT_ADMIN" as const };

function resetData() {
  fakePrisma._data.elections.length = 0;
  fakePrisma._data.partyLists.length = 0;
  fakePrisma._data.accessCodes.length = 0;
  fakePrisma._data.ballots.length = 0;
}

describe("getOwnedElection", () => {
  beforeEach(resetData);

  it("returns the election for its own account admin", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", createdById: "admin1" });
    const result = await getOwnedElection("e1", owner);
    expect(result?.id).toBe("e1");
  });

  it("returns null for a different account admin", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", createdById: "admin1" });
    const result = await getOwnedElection("e1", otherAccountAdmin);
    expect(result).toBeNull();
  });

  it("returns the election for a product admin regardless of owner", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", createdById: "admin1" });
    const result = await getOwnedElection("e1", productAdmin);
    expect(result?.id).toBe("e1");
  });

  it("returns null for an election that doesn't exist", async () => {
    const result = await getOwnedElection("does-not-exist", productAdmin);
    expect(result).toBeNull();
  });
});

describe("getOwnedPartyList", () => {
  beforeEach(resetData);

  it("resolves ownership through the parent election", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", createdById: "admin1" });
    fakePrisma._data.partyLists.push({ id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A" });
    expect(await getOwnedPartyList("l1", owner)).not.toBeNull();
    expect(await getOwnedPartyList("l1", otherAccountAdmin)).toBeNull();
  });
});

describe("getOwnedAccessCode", () => {
  beforeEach(resetData);

  it("resolves ownership through the parent election", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", createdById: "admin1" });
    fakePrisma._data.accessCodes.push({ id: "c1", electionId: "e1", codeHash: "h", maxUses: null, useCount: 0, active: true, expiresAt: null });
    expect(await getOwnedAccessCode("c1", owner)).not.toBeNull();
    expect(await getOwnedAccessCode("c1", otherAccountAdmin)).toBeNull();
  });
});

describe("getOwnedBallot", () => {
  beforeEach(resetData);

  it("resolves ownership through the parent election", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", createdById: "admin1" });
    fakePrisma._data.ballots.push({ id: "b1", electionId: "e1", voterSessionId: "vs1", ranking: "[]", submittedAt: new Date() });
    expect(await getOwnedBallot("b1", owner)).not.toBeNull();
    expect(await getOwnedBallot("b1", otherAccountAdmin)).toBeNull();
  });
});
