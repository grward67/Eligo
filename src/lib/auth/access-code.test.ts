import { describe, it, expect } from "vitest";
import { generateAccessCode, normalizeAccessCode, hashAccessCode } from "./access-code";

describe("access codes", () => {
  it("generates codes in the expected XXXXX-XXXXX format", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });

  it("never includes visually ambiguous characters", () => {
    for (let i = 0; i < 25; i++) {
      expect(generateAccessCode()).not.toMatch(/[01OIL]/);
    }
  });

  it("generates different codes on each call", () => {
    const codes = new Set(Array.from({ length: 25 }, () => generateAccessCode()));
    expect(codes.size).toBe(25);
  });

  it("normalizes case, spaces, and dashes consistently", () => {
    expect(normalizeAccessCode("ab3d4-efg5h")).toBe("AB3D4EFG5H");
    expect(normalizeAccessCode(" AB3D4-EFG5H ")).toBe("AB3D4EFG5H");
    expect(normalizeAccessCode("AB3D4EFG5H")).toBe("AB3D4EFG5H");
  });

  it("hashes equivalent codes (case/dash-insensitive) to the same value", () => {
    expect(hashAccessCode("ab3d4-efg5h")).toBe(hashAccessCode("AB3D4EFG5H"));
    expect(hashAccessCode(" AB3D4-EFG5H ")).toBe(hashAccessCode("AB3D4EFG5H"));
  });

  it("hashes different codes to different values", () => {
    expect(hashAccessCode("AAAAA-AAAAA")).not.toBe(hashAccessCode("BBBBB-BBBBB"));
  });

  it("produces a hex-encoded SHA-256-length digest", () => {
    expect(hashAccessCode("AAAAA-AAAAA")).toMatch(/^[0-9a-f]{64}$/);
  });
});
