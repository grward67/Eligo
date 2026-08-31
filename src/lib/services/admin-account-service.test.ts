import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../../../tests/fakes/fake-prisma";

const fakePrisma = createFakePrisma();
vi.mock("@/lib/db", () => ({ prisma: fakePrisma }));

const { registerAdmin, RegisterAdminValidationError } = await import("./admin-account-service");

describe("registerAdmin", () => {
  beforeEach(() => {
    fakePrisma._data.admins.length = 0;
    fakePrisma._data.auditLogs.length = 0;
  });

  it("creates a new ACCOUNT_ADMIN with a hashed password", async () => {
    const result = await registerAdmin("new@example.com", "supersecret1");
    expect(result.ok).toBe(true);
    expect(fakePrisma._data.admins).toHaveLength(1);
    expect(fakePrisma._data.admins[0].email).toBe("new@example.com");
    expect(fakePrisma._data.admins[0].role).toBe("ACCOUNT_ADMIN");
    expect(fakePrisma._data.admins[0].passwordHash).not.toBe("supersecret1");
    expect(fakePrisma._data.auditLogs).toHaveLength(1);
  });

  it("refuses to register a second admin with the same email", async () => {
    await registerAdmin("dup@example.com", "supersecret1");
    const result = await registerAdmin("dup@example.com", "anotherpass1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("EMAIL_TAKEN");
    expect(fakePrisma._data.admins).toHaveLength(1);
  });

  it("rejects a password shorter than the minimum length", async () => {
    await expect(registerAdmin("short@example.com", "abc")).rejects.toThrow(RegisterAdminValidationError);
    expect(fakePrisma._data.admins).toHaveLength(0);
  });
});
