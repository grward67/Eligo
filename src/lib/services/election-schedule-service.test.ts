import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { applyDueScheduleTransitions, updateSchedule } = await import("./election-schedule-service");

function resetData() {
  fakePrisma._data.elections.length = 0;
  fakePrisma._data.auditLogs.length = 0;
}

describe("applyDueScheduleTransitions", () => {
  beforeEach(resetData);

  it("does nothing for an election with no schedule set", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "Plain election", status: "DRAFT" });
    await applyDueScheduleTransitions("e1");
    expect(fakePrisma._data.elections[0].status).toBe("DRAFT");
    expect(fakePrisma._data.auditLogs).toHaveLength(0);
  });

  it("does nothing while the scheduled start is still in the future", async () => {
    fakePrisma._data.elections.push({
      id: "e1",
      title: "Future election",
      status: "DRAFT",
      scheduledStartAt: new Date(Date.now() + 60_000),
    });
    await applyDueScheduleTransitions("e1");
    expect(fakePrisma._data.elections[0].status).toBe("DRAFT");
    expect(fakePrisma._data.auditLogs).toHaveLength(0);
  });

  it("opens a DRAFT election once its scheduled start has passed, backdating the audit entry", async () => {
    const startAt = new Date(Date.now() - 60_000);
    fakePrisma._data.elections.push({ id: "e1", title: "Due election", status: "DRAFT", scheduledStartAt: startAt });

    await applyDueScheduleTransitions("e1");

    expect(fakePrisma._data.elections[0].status).toBe("OPEN");
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
    const log = fakePrisma._data.auditLogs[0];
    expect(log.actorType).toBe("system");
    expect(log.action).toBe("election.status_change");
    expect(JSON.parse(log.metadata!)).toEqual({ status: "OPEN", source: "schedule" });
    expect(log.createdAt).toEqual(startAt);
  });

  it("closes an OPEN election once its scheduled end has passed, backdating the audit entry", async () => {
    const endAt = new Date(Date.now() - 60_000);
    fakePrisma._data.elections.push({ id: "e1", title: "Due election", status: "OPEN", scheduledEndAt: endAt });

    await applyDueScheduleTransitions("e1");

    expect(fakePrisma._data.elections[0].status).toBe("CLOSED");
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
    const log = fakePrisma._data.auditLogs[0];
    expect(JSON.parse(log.metadata!)).toEqual({ status: "CLOSED", source: "schedule" });
    expect(log.createdAt).toEqual(endAt);
  });

  it("catches up through both transitions in one call when both instants have already passed", async () => {
    const startAt = new Date(Date.now() - 120_000);
    const endAt = new Date(Date.now() - 60_000);
    fakePrisma._data.elections.push({
      id: "e1",
      title: "Long overdue election",
      status: "DRAFT",
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
    });

    await applyDueScheduleTransitions("e1");

    expect(fakePrisma._data.elections[0].status).toBe("CLOSED");
    expect(fakePrisma._data.auditLogs).toHaveLength(2);
    expect(fakePrisma._data.auditLogs[0].createdAt).toEqual(startAt);
    expect(fakePrisma._data.auditLogs[1].createdAt).toEqual(endAt);
  });

  it("never touches an already-CLOSED election", async () => {
    const endAt = new Date(Date.now() - 60_000);
    fakePrisma._data.elections.push({ id: "e1", title: "Closed election", status: "CLOSED", scheduledEndAt: endAt });
    await applyDueScheduleTransitions("e1");
    expect(fakePrisma._data.auditLogs).toHaveLength(0);
  });

  it("is a no-op for an unknown election id", async () => {
    await expect(applyDueScheduleTransitions("does-not-exist")).resolves.toBeUndefined();
  });
});

describe("updateSchedule", () => {
  beforeEach(resetData);

  it("sets both start and end while DRAFT", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    const start = new Date(Date.now() + 60_000);
    const end = new Date(Date.now() + 120_000);

    const result = await updateSchedule("e1", { scheduledStartAt: start, scheduledEndAt: end, scheduleTimezone: "Europe/London" }, "admin1");

    expect(result.ok).toBe(true);
    expect(fakePrisma._data.elections[0].scheduledStartAt).toEqual(start);
    expect(fakePrisma._data.elections[0].scheduledEndAt).toEqual(end);
    expect(fakePrisma._data.elections[0].scheduleTimezone).toBe("Europe/London");
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
    expect(fakePrisma._data.auditLogs[0].action).toBe("election.schedule_change");
  });

  it("sets only the end while OPEN, leaving any previously-set start untouched", async () => {
    const existingStart = new Date(Date.now() - 3_600_000);
    fakePrisma._data.elections.push({
      id: "e1",
      title: "e",
      status: "OPEN",
      scheduledStartAt: existingStart,
      scheduleTimezone: "Europe/London",
    });
    const end = new Date(Date.now() + 60_000);

    const result = await updateSchedule("e1", { scheduledEndAt: end, scheduleTimezone: "Europe/London" }, "admin1");

    expect(result.ok).toBe(true);
    expect(fakePrisma._data.elections[0].scheduledStartAt).toEqual(existingStart);
    expect(fakePrisma._data.elections[0].scheduledEndAt).toEqual(end);
  });

  it("refuses to set a start time while OPEN", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "OPEN" });
    const result = await updateSchedule(
      "e1",
      { scheduledStartAt: new Date(Date.now() + 60_000), scheduledEndAt: new Date(Date.now() + 120_000), scheduleTimezone: "Europe/London" },
      "admin1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("START_NOT_ALLOWED");
  });

  it("refuses to schedule an end date in the past", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    const result = await updateSchedule("e1", { scheduledEndAt: new Date(Date.now() - 60_000), scheduleTimezone: "Europe/London" }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("END_IN_PAST");
  });

  it("refuses an end time at or before the start time", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    const start = new Date(Date.now() + 120_000);
    const end = new Date(Date.now() + 60_000);
    const result = await updateSchedule("e1", { scheduledStartAt: start, scheduledEndAt: end, scheduleTimezone: "Europe/London" }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_RANGE");
  });

  it("requires a timezone when setting a date", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    const result = await updateSchedule("e1", { scheduledEndAt: new Date(Date.now() + 60_000), scheduleTimezone: null }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("TIMEZONE_REQUIRED");
  });

  it("rejects an unrecognized timezone", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "DRAFT" });
    const result = await updateSchedule("e1", { scheduledEndAt: new Date(Date.now() + 60_000), scheduleTimezone: "Not/AZone" }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_TIMEZONE");
  });

  it("clears an existing schedule", async () => {
    fakePrisma._data.elections.push({
      id: "e1",
      title: "e",
      status: "DRAFT",
      scheduledStartAt: new Date(Date.now() + 60_000),
      scheduledEndAt: new Date(Date.now() + 120_000),
      scheduleTimezone: "Europe/London",
    });
    const result = await updateSchedule("e1", { scheduledStartAt: null, scheduledEndAt: null, scheduleTimezone: null }, "admin1");
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.elections[0].scheduledStartAt).toBeNull();
    expect(fakePrisma._data.elections[0].scheduledEndAt).toBeNull();
    expect(fakePrisma._data.elections[0].scheduleTimezone).toBeNull();
  });

  it("refuses to change the schedule once CLOSED", async () => {
    fakePrisma._data.elections.push({ id: "e1", title: "e", status: "CLOSED" });
    const result = await updateSchedule("e1", { scheduledEndAt: null, scheduleTimezone: null }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("CLOSED");
  });

  it("reports NOT_FOUND for an unknown election", async () => {
    const result = await updateSchedule("does-not-exist", { scheduledEndAt: null, scheduleTimezone: null }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("NOT_FOUND");
  });
});
