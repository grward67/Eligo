import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  title: z.string().min(1),
  seats: z.number().int().min(1),
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

  const election = await prisma.election.create({
    data: { title: parsed.data.title, seats: parsed.data.seats },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: admin.sub,
    action: "election.create",
    targetType: "Election",
    targetId: election.id,
    metadata: { title: election.title, seats: election.seats },
  });

  return NextResponse.json({ ok: true, election });
}
