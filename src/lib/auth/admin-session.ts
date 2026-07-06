import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

// Separate cookie + secret from the voter session below: an admin JWT
// must never be usable to satisfy a voter check, or vice versa.
export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8h

const ALG = "HS256";
const EXPIRY = "8h";

function secretKey() {
  return new TextEncoder().encode(env.adminSessionSecret);
}

export interface AdminSessionPayload {
  sub: string;
  email: string;
}

export async function signAdminSession(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secretKey());
}

export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email = payload.email;
    if (!payload.sub || typeof email !== "string") return null;
    return { sub: payload.sub, email };
  } catch {
    return null;
  }
}
