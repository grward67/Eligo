import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessCode } from "@/lib/services/verify-service";
import { signVoterSession, VOTER_SESSION_COOKIE, VOTER_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/voter-session";

const bodySchema = z.object({
  electionId: z.string().min(1),
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await verifyAccessCode(parsed.data.electionId, parsed.data.code);

  if (!result.ok) {
    const message =
      result.error === "ELECTION_NOT_OPEN"
        ? "Voting is not currently open for this election."
        : "That code isn't valid. Please check it and try again.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const token = await signVoterSession({ voterSessionId: result.voterSessionId, electionId: result.electionId });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(VOTER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VOTER_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
