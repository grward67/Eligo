import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { getOwnedElection } from "@/lib/auth/election-access";
import { addCandidate } from "@/lib/services/candidate-service";

const bodySchema = z.object({
  name: z.string().min(1),
  party: z.string().nullable().optional(),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Election not found.",
  NOT_DRAFT: "Candidates can only be added while the election is still in Draft.",
};

export async function POST(request: NextRequest, { params }: { params: { electionId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await getOwnedElection(params.electionId, admin))) {
    return NextResponse.json({ error: "Election not found." }, { status: 404 });
  }

  const result = await addCandidate(params.electionId, parsed.data.name, parsed.data.party ?? null, admin.sub);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not add candidate." }, { status });
  }

  return NextResponse.json({ ok: true, candidate: result.candidate });
}
