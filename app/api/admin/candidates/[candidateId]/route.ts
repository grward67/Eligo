import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { getOwnedCandidate } from "@/lib/auth/election-access";
import { updateCandidate } from "@/lib/services/candidate-service";

const bodySchema = z.object({
  name: z.string().min(1),
  party: z.string().nullable().optional(),
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

  if (!(await getOwnedCandidate(params.candidateId, admin))) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const result = await updateCandidate(params.candidateId, parsed.data.name, parsed.data.party ?? null, admin.sub);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not update candidate." }, { status });
  }

  return NextResponse.json({ ok: true, candidate: result.candidate });
}
