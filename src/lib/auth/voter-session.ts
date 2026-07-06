import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const VOTER_SESSION_COOKIE = "voter_session";
export const VOTER_SESSION_MAX_AGE_SECONDS = 2 * 60 * 60; // 2h

const ALG = "HS256";
const EXPIRY = "2h";

function secretKey() {
  return new TextEncoder().encode(env.voterSessionSecret);
}

export interface VoterSessionPayload {
  voterSessionId: string;
  electionId: string;
}

export async function signVoterSession(payload: VoterSessionPayload): Promise<string> {
  return new SignJWT({ electionId: payload.electionId })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.voterSessionId)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secretKey());
}

export async function verifyVoterSession(token: string): Promise<VoterSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const electionId = payload.electionId;
    if (!payload.sub || typeof electionId !== "string") return null;
    return { voterSessionId: payload.sub, electionId };
  } catch {
    return null;
  }
}
