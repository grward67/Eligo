import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { getOwnedPartyListCandidate } from "@/lib/auth/election-access";
import { updateListCandidate } from "@/lib/services/party-list-service";

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Candidate not found.",
  NOT_DRAFT: "Candidates can only be edited while the election is still in Draft.",
};

export async function POST(request: NextRequest, { params }: { params: { candidateId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await getOwnedPartyListCandidate(params.candidateId, admin))) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const result = await updateListCandidate(params.candidateId, parsed.data.firstName, parsed.data.lastName, admin.sub);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not update candidate." }, { status });
  }

  return NextResponse.json({ ok: true, candidate: result.candidate });
}
