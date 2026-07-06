import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireVoterSession } from "@/lib/auth/require-voter";
import { submitBallot } from "@/lib/services/ballot-service";
import { VOTER_SESSION_COOKIE } from "@/lib/auth/voter-session";

const bodySchema = z.object({
  electionId: z.string().min(1),
  ranking: z.array(z.string().min(1)).min(1),
});

const ERROR_MESSAGES: Record<string, string> = {
  SESSION_NOT_FOUND: "Your session is no longer valid. Please re-enter your access code.",
  SESSION_EXPIRED: "Your session has expired. Please re-enter your access code.",
  ALREADY_SUBMITTED: "A ballot has already been submitted for this session.",
  ELECTION_NOT_OPEN: "This election is not currently open for voting.",
  INVALID_RANKING: "Your ranking includes an invalid or duplicate candidate.",
};

export async function POST(request: NextRequest) {
  const voterSession = await requireVoterSession();
  if (!voterSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.electionId !== voterSession.electionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await submitBallot(voterSession.voterSessionId, parsed.data.electionId, parsed.data.ranking);

  if (!result.ok) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 409 });
  }

  const response = NextResponse.json({ ok: true, ballotId: result.ballotId });
  response.cookies.set(VOTER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
