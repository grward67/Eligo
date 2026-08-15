import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { updatePrSettings } from "@/lib/services/election-service";

const bodySchema = z.object({
  prThreshold: z.number().min(0).max(100),
  prCalculationMethod: z.enum(["DHONDT", "SAINTE_LAGUE"]),
  prAllowBlankVote: z.boolean(),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Election not found.",
  NOT_DRAFT: "These settings can only be changed while the election is still in Draft.",
  INVALID_THRESHOLD: "Threshold must be between 0 and 100.",
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

  const result = await updatePrSettings(params.electionId, parsed.data, admin.sub);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : result.error === "NOT_DRAFT" ? 409 : 400;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not update settings." }, { status });
  }

  return NextResponse.json({ ok: true });
}
