import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { createPartyList } from "@/lib/services/party-list-service";

const bodySchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Election not found.",
  NOT_DRAFT: "Lists can only be added while the election is still in Draft.",
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

  const result = await createPartyList(params.electionId, parsed.data.name, parsed.data.abbreviation, admin.sub);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not create the list." }, { status });
  }

  return NextResponse.json({ ok: true, list: result.list, warning: result.warning ?? null });
}
