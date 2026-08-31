import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { getPlatformSettings, updatePlatformSettings } = await import("./platform-settings-service");

describe("getPlatformSettings", () => {
  beforeEach(() => {
    fakePrisma._data.platformSettings.length = 0;
  });

  it("falls back to defaults when no settings row exists yet", async () => {
    const settings = await getPlatformSettings();
    expect(settings).toEqual({ ballotQuotaLimit: 5, ballotQuotaPeriodDays: 30 });
  });

  it("returns the stored settings row when one exists", async () => {
    fakePrisma._data.platformSettings.push({ id: "s1", ballotQuotaLimit: 10, ballotQuotaPeriodDays: 14 });
    const settings = await getPlatformSettings();
    expect(settings).toEqual({ ballotQuotaLimit: 10, ballotQuotaPeriodDays: 14 });
  });
});

describe("updatePlatformSettings", () => {
  beforeEach(() => {
    fakePrisma._data.platformSettings.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("creates the settings row if none exists", async () => {
    const result = await updatePlatformSettings({ ballotQuotaLimit: 8, ballotQuotaPeriodDays: 7 }, "admin1");
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.platformSettings).toHaveLength(1);
    expect(fakePrisma._data.platformSettings[0]).toMatchObject({ ballotQuotaLimit: 8, ballotQuotaPeriodDays: 7 });
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("updates the existing settings row in place rather than duplicating it", async () => {
    fakePrisma._data.platformSettings.push({ id: "s1", ballotQuotaLimit: 5, ballotQuotaPeriodDays: 30 });
    const result = await updatePlatformSettings({ ballotQuotaLimit: 20, ballotQuotaPeriodDays: 60 }, "admin1");
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.platformSettings).toHaveLength(1);
    expect(fakePrisma._data.platformSettings[0]).toMatchObject({ ballotQuotaLimit: 20, ballotQuotaPeriodDays: 60 });
  });

  it("rejects a non-positive quota limit", async () => {
    const result = await updatePlatformSettings({ ballotQuotaLimit: 0, ballotQuotaPeriodDays: 30 }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_LIMIT");
  });

  it("rejects a non-positive quota period", async () => {
    const result = await updatePlatformSettings({ ballotQuotaLimit: 5, ballotQuotaPeriodDays: 0 }, "admin1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_PERIOD");
  });
});
