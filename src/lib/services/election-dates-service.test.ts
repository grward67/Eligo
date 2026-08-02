import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { getElectionActualDates } = await import("./election-dates-service");

describe("getElectionActualDates", () => {
  beforeEach(() => {
    fakePrisma._data.auditLogs.length = 0;
  });

  it("returns null dates when there's no status-change history", async () => {
    const dates = await getElectionActualDates("e1");
    expect(dates.startedAt).toBeNull();
    expect(dates.endedAt).toBeNull();
  });

  it("uses the first OPEN and the most recent CLOSED, even across multiple open/close cycles", async () => {
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

    const dates = await getElectionActualDates("e1");
    expect(dates.startedAt).toBe(openedFirst.toISOString());
    expect(dates.endedAt).toBe(closedFinal.toISOString());
  });

  it("ignores status-change events for a different election", async () => {
    fakePrisma._data.auditLogs.push({
      id: "a1",
      actorType: "admin",
      actorId: "admin1",
      action: "election.status_change",
      targetType: "Election",
      targetId: "some-other-election",
      metadata: JSON.stringify({ status: "OPEN" }),
      createdAt: new Date(),
    });

    const dates = await getElectionActualDates("e1");
    expect(dates.startedAt).toBeNull();
  });

  it("ignores malformed metadata rather than throwing", async () => {
    fakePrisma._data.auditLogs.push({
      id: "a1",
      actorType: "admin",
      actorId: "admin1",
      action: "election.status_change",
      targetType: "Election",
      targetId: "e1",
      metadata: "not valid json",
      createdAt: new Date(),
    });

    await expect(getElectionActualDates("e1")).resolves.toEqual({ startedAt: null, endedAt: null });
  });
});
