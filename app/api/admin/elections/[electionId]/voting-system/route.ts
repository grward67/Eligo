import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { updateVotingSystem } from "@/lib/services/election-service";

const bodySchema = z.object({
  votingSystem: z.enum(["STV", "FPTP"]),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Election not found.",
  NOT_DRAFT: "The ballot type can only be changed while the election is still in Draft.",
  HAS_BALLOTS: "The ballot type can't be changed once ballots have been submitted.",
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

  const result = await updateVotingSystem(params.electionId, parsed.data.votingSystem, admin.sub);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not update ballot type." }, { status });
  }

  return NextResponse.json({ ok: true });
}
