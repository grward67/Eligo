import { cookies } from "next/headers";
import { VOTER_SESSION_COOKIE, verifyVoterSession, type VoterSessionPayload } from "@/lib/auth/voter-session";

/** Authoritative voter-session check for use in Server Components and route handlers. */
export async function requireVoterSession(): Promise<VoterSessionPayload | null> {
  const token = cookies().get(VOTER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyVoterSession(token);
}
