import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";
import { deleteElections } from "@/lib/services/election-service";
import { getBallotQuotaStatus } from "@/lib/services/quota-service";

const bodySchema = z.object({
  title: z.string().min(1),
  seats: z.number().int().min(1),
  votingSystem: z.enum(["STV", "FPTP", "PR"]).default("STV"),
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

  if (admin.role !== "PRODUCT_ADMIN") {
    const quota = await getBallotQuotaStatus(admin.sub);
    if (quota.exceeded) {
      return NextResponse.json(
        { error: `You've reached your limit of ${quota.limit} ballot(s) per ${quota.periodDays} day(s).` },
        { status: 403 }
      );
    }
  }

  const election = await prisma.election.create({
    data: { title: parsed.data.title, seats: parsed.data.seats, votingSystem: parsed.data.votingSystem, createdById: admin.sub },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: admin.sub,
    action: "election.create",
    targetType: "Election",
    targetId: election.id,
    metadata: { title: election.title, seats: election.seats, votingSystem: election.votingSystem },
  });

  return NextResponse.json({ ok: true, election });
}

const deleteBodySchema = z.object({
  electionIds: z.array(z.string().min(1)).min(1),
});

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deleteBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await deleteElections(parsed.data.electionIds, admin);
  return NextResponse.json(result);
}
