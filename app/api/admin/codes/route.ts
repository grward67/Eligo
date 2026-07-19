import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { generateCodes, MAX_GENERATE_COUNT } from "@/lib/services/code-service";

const bodySchema = z.object({
  electionId: z.string().min(1),
  count: z.number().int().min(1).max(MAX_GENERATE_COUNT),
  maxUses: z.number().int().min(1).nullable(),
  label: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const codes = await generateCodes({
    electionId: parsed.data.electionId,
    count: parsed.data.count,
    maxUses: parsed.data.maxUses,
    label: parsed.data.label ?? null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    createdById: admin.sub,
  });

  return NextResponse.json({ ok: true, codes });
}
