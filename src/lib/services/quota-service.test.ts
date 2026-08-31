import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { getBallotQuotaStatus } = await import("./quota-service");

describe("getBallotQuotaStatus", () => {
  beforeEach(() => {
    fakePrisma._data.platformSettings.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  function pushCreateEvent(adminId: string, daysAgo: number) {
    fakePrisma._data.auditLogs.push({
      id: `log_${Math.random()}`,
      actorType: "admin",
      actorId: adminId,
      action: "election.create",
      targetType: "Election",
      targetId: "e1",
      metadata: null,
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    });
  }

  it("uses the platform defaults when no settings row exists", async () => {
    const status = await getBallotQuotaStatus("admin1");
    expect(status.limit).toBe(5);
    expect(status.periodDays).toBe(30);
    expect(status.used).toBe(0);
    expect(status.exceeded).toBe(false);
  });

  it("counts only election.create events within the trailing window", async () => {
    fakePrisma._data.platformSettings.push({ id: "s1", ballotQuotaLimit: 3, ballotQuotaPeriodDays: 10 });
    pushCreateEvent("admin1", 1);
    pushCreateEvent("admin1", 5);
    pushCreateEvent("admin1", 20); // outside the 10-day window

    const status = await getBallotQuotaStatus("admin1");
    expect(status.used).toBe(2);
    expect(status.remaining).toBe(1);
    expect(status.exceeded).toBe(false);
  });

  it("reports exceeded once usage reaches the limit", async () => {
    fakePrisma._data.platformSettings.push({ id: "s1", ballotQuotaLimit: 2, ballotQuotaPeriodDays: 30 });
    pushCreateEvent("admin1", 1);
    pushCreateEvent("admin1", 2);

    const status = await getBallotQuotaStatus("admin1");
    expect(status.used).toBe(2);
    expect(status.remaining).toBe(0);
    expect(status.exceeded).toBe(true);
  });

  it("counts a deleted election's create event just the same (quota isn't dodged by deleting)", async () => {
    fakePrisma._data.platformSettings.push({ id: "s1", ballotQuotaLimit: 1, ballotQuotaPeriodDays: 30 });
    pushCreateEvent("admin1", 1);
    // No corresponding Election row exists (as if it had since been deleted) --
    // the quota check only ever looks at the audit log, so this still counts.
    const status = await getBallotQuotaStatus("admin1");
    expect(status.used).toBe(1);
    expect(status.exceeded).toBe(true);
  });

  it("scopes usage to the given admin only", async () => {
    fakePrisma._data.platformSettings.push({ id: "s1", ballotQuotaLimit: 5, ballotQuotaPeriodDays: 30 });
    pushCreateEvent("admin1", 1);
    pushCreateEvent("admin2", 1);
    pushCreateEvent("admin2", 2);

    const status = await getBallotQuotaStatus("admin1");
    expect(status.used).toBe(1);
  });
});
