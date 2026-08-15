import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { createPartyList, addListCandidate } = await import("./party-list-service");

function resetData() {
  fakePrisma._data.elections.length = 0;
  fakePrisma._data.partyLists.length = 0;
  fakePrisma._data.partyListCandidates.length = 0;
  fakePrisma._data.auditLogs.length = 0;
}

describe("createPartyList", () => {
  beforeEach(resetData);

  it("creates a list while DRAFT and warns that it has no candidates yet", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", seats: 3 });
    const result = await createPartyList("e1", "Alpha Party", "ALP", "admin1");
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.partyLists).toHaveLength(1);
    expect(result.warning).toMatch(/fewer than the 3 total seat/);
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("assigns increasing sortOrder to successive lists", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", seats: 1 });
    await createPartyList("e1", "Alpha", "A", "admin1");
    await createPartyList("e1", "Beta", "B", "admin1");
    expect(fakePrisma._data.partyLists.map((l) => l.sortOrder)).toEqual([0, 1]);
  });

  it("refuses to create a list once the election is OPEN", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "OPEN", seats: 1 });
    const result = await createPartyList("e1", "Alpha", "A", "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_DRAFT");
  });

  it("reports NOT_FOUND for an unknown election", async () => {
    const result = await createPartyList("does-not-exist", "Alpha", "A", "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_FOUND");
  });
});

describe("addListCandidate", () => {
  beforeEach(resetData);

  it("adds a candidate with the next rank and no warning once the seat minimum is met", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT", seats: 2 });
    fakePrisma._data.partyLists.push({ id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A" });

    const first = await addListCandidate("l1", "Jane", "Doe", "admin1");
    expect(first.ok).toBe(true);
    expect(first.candidate).toMatchObject({ firstName: "Jane", lastName: "Doe", rank: 1 });
    expect(first.warning).toBeDefined();

    const second = await addListCandidate("l1", "John", "Smith", "admin1");
    expect(second.candidate?.rank).toBe(2);
    expect(second.warning).toBeUndefined();

    expect(fakePrisma._data.auditLogs).toHaveLength(2);
  });

  it("refuses to add a candidate once the election is OPEN", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "OPEN", seats: 1 });
    fakePrisma._data.partyLists.push({ id: "l1", electionId: "e1", name: "Alpha", abbreviation: "A" });
    const result = await addListCandidate("l1", "Jane", "Doe", "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_DRAFT");
  });

  it("reports LIST_NOT_FOUND for an unknown list", async () => {
    const result = await addListCandidate("does-not-exist", "Jane", "Doe", "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("LIST_NOT_FOUND");
  });
});
