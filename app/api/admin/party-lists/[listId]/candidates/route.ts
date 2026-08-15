import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { addListCandidate } from "@/lib/services/party-list-service";

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const ERROR_MESSAGES: Record<string, string> = {
  LIST_NOT_FOUND: "List not found.",
  NOT_DRAFT: "Candidates can only be added while the election is still in Draft.",
};

export async function POST(request: NextRequest, { params }: { params: { listId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await addListCandidate(params.listId, parsed.data.firstName, parsed.data.lastName, admin.sub);

  if (!result.ok) {
    const status = result.error === "LIST_NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: ERROR_MESSAGES[result.error ?? ""] ?? "Could not add candidate." }, { status });
  }

  return NextResponse.json({ ok: true, candidate: result.candidate, warning: result.warning ?? null });
}
