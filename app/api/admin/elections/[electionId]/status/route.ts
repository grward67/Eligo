import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]),
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

  const election = await prisma.election.update({
    where: { id: params.electionId },
    data: { status: parsed.data.status },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: admin.sub,
    action: "election.status_change",
    targetType: "Election",
    targetId: election.id,
    metadata: { status: election.status },
  });

  return NextResponse.json({ ok: true, election });
}
