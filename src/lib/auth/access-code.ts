import crypto from "node:crypto";
import { env } from "@/lib/env";

// Excludes visually ambiguous characters: 0, O, 1, I, L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

/** Generates a fresh plaintext access code, e.g. "AB3D4-EFG5H". Never persisted as-is. */
export function generateAccessCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    raw += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Case/whitespace/dash-insensitive so voters can type codes loosely. */
export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * HMAC-SHA256 keyed hash so codes can be looked up by exact match in the
 * database without ever storing (or being able to reverse to) plaintext.
 * A keyed hash (vs. plain SHA-256) means the hash is useless without the
 * server secret, even if the codeHash column were ever leaked.
 */
export function hashAccessCode(code: string): string {
  const normalized = normalizeAccessCode(code);
  return crypto.createHmac("sha256", env.accessCodeHashSecret).update(normalized).digest("hex");
}
