import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  name: z.string().min(1),
  party: z.string().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { electionId: string } }) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const count = await prisma.candidate.count({ where: { electionId: params.electionId } });

  const candidate = await prisma.candidate.create({
    data: {
      electionId: params.electionId,
      name: parsed.data.name,
      party: parsed.data.party ?? null,
      sortOrder: count,
    },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: admin.sub,
    action: "candidate.create",
    targetType: "Election",
    targetId: params.electionId,
    metadata: { candidateId: candidate.id, name: candidate.name },
  });

  return NextResponse.json({ ok: true, candidate });
}
