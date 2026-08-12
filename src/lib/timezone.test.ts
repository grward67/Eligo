import { describe, it, expect } from "vitest";
import { zonedTimeToUtc, getWallClockParts, formatInTimeZone, isValidTimeZone, listTimeZones } from "./timezone";

describe("zonedTimeToUtc", () => {
  it("converts a winter (GMT, UTC+0) London time correctly", () => {
    // 10 Jan 2026, 12:00 London time = 12:00 UTC (no DST in January).
    const utc = zonedTimeToUtc(2026, 1, 10, 12, 0, "Europe/London");
    expect(utc.toISOString()).toBe("2026-01-10T12:00:00.000Z");
  });

  it("converts a summer (BST, UTC+1) London time correctly", () => {
    // 10 Jul 2026, 12:00 London time = 11:00 UTC (British Summer Time is +1).
    const utc = zonedTimeToUtc(2026, 7, 10, 12, 0, "Europe/London");
    expect(utc.toISOString()).toBe("2026-07-10T11:00:00.000Z");
  });

  it("handles a time on the far side of a DST transition correctly", () => {
    // UK clocks go forward at 01:00 GMT on the last Sunday in March (29 Mar 2026).
    // 10:00 local time that day is already BST (+1), i.e. 09:00 UTC.
    const utc = zonedTimeToUtc(2026, 3, 29, 10, 0, "Europe/London");
    expect(utc.toISOString()).toBe("2026-03-29T09:00:00.000Z");
  });

  it("converts a New York time correctly, accounting for its own DST rules", () => {
    // 10 Jul 2026, 12:00 New York time (EDT, UTC-4) = 16:00 UTC.
    const utc = zonedTimeToUtc(2026, 7, 10, 12, 0, "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-10T16:00:00.000Z");
  });

  it("round-trips through getWallClockParts", () => {
    const utc = zonedTimeToUtc(2026, 9, 15, 14, 30, "Australia/Sydney");
    const parts = getWallClockParts(utc, "Australia/Sydney");
    expect(parts).toEqual({ year: 2026, month: 9, day: 15, hour: 14, minute: 30 });
  });
});

describe("formatInTimeZone", () => {
  it("renders a readable date/time string in the given zone", () => {
    const instant = new Date("2026-07-10T11:00:00.000Z");
    expect(formatInTimeZone(instant, "Europe/London")).toMatch(/10 Jul 2026, 12:00/);
  });
});

describe("isValidTimeZone", () => {
  it("accepts a real IANA zone", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
  });

  it("rejects a made-up zone name", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("listTimeZones", () => {
  it("includes well-known zones", () => {
    const zones = listTimeZones();
    expect(zones).toContain("Europe/London");
    expect(zones).toContain("UTC");
    expect(zones.length).toBeGreaterThan(10);
  });
});
